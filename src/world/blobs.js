// Blob shadows (graphics pass 2): a soft dark disc under characters and vehicles that are beyond the sun's shadow-map
// range, so distant people and traffic don't float. ONE InstancedMesh for everything; systems register objects:
//   const h = world.blobShadow(object3D, radius, {stretch})   // stretch: length/width ratio along the object's heading
//   h.remove()                                                 // when the object is disposed
// Each frame (world.update) the registry is walked: entries not in the world scene, hidden (self or an ancestor), inside
// the shadow box (real shadows there) or further than FAR from the camera are skipped. Off on the 'low' tier.
import * as THREE from 'three';

const MAX = 96, FAR = 170;

function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function createBlobs(game, scene) {
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTexture(), transparent: true, opacity: 0.42, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16, name: 'blobShadow' });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.renderOrder = 1; mesh.name = 'world:blobs'; mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  const list = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), wp = new THREE.Vector3();
  const B = { enabled: true, inner: 50, mesh, list, shown: 0 };

  B.add = (obj, radius = 0.45, opts = {}) => {
    const e = { obj, r: radius, stretch: opts.stretch || 1, y: opts.y ?? null };
    list.push(e);
    return { remove: () => { const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); }, entry: e };
  };

  const inWorld = (o) => {
    for (let a = o; a; a = a.parent) { if (!a.visible) return false; if (a === scene) return true; }
    return false;
  };

  B.update = (night) => {
    let n = 0;
    if (B.enabled && game.scene === scene && list.length) {
      const cam = game.camera.position, pl = game.player.pos, inner = B.inner, inner2 = inner * inner, far2 = FAR * FAR;
      mat.opacity = 0.42 * (1 - 0.45 * night);     // fainter by moonlight
      for (let i = 0; i < list.length && n < MAX; i++) {
        const e = list[i], o = e.obj;
        if (!inWorld(o)) continue;
        wp.setFromMatrixPosition(o.matrixWorld);   // last frame's matrix: no extra traversal
        const dx = wp.x - pl.x, dz = wp.z - pl.z;
        if (dx * dx + dz * dz < inner2) continue;                // the shadow map covers it
        const cx = wp.x - cam.x, cz = wp.z - cam.z, d2 = cx * cx + cz * cz;
        if (d2 > far2) continue;
        // heading from the object's world rotation (yaw only)
        const el = o.matrixWorld.elements, yaw = Math.atan2(el[8], el[10]);
        q.setFromAxisAngle(up, yaw);
        const fade = Math.min(1, (Math.sqrt(dx * dx + dz * dz) - inner) / 8);
        s.set(e.r * 2.2 * fade, 1, e.r * 2.2 * e.stretch * fade);
        p.set(wp.x, (e.y ?? wp.y) + 0.04, wp.z);
        m4.compose(p, q, s);
        mesh.setMatrixAt(n++, m4);
      }
    }
    if (n || B.shown) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; }
    mesh.visible = n > 0; B.shown = n;
  };
  return B;
}
