// Soft contact shade under people and vehicles in diffuse light (shader pass 10; tier field `contact`, ?contact=0).
//
// Under a full deck of cloud, in fog and in drizzle the sun casts no shadows (sky.js takes the shadow map's strength to
// zero) — and then nothing tied a car or a walker to the road except the 0.5 m ambient occlusion, so on the commonest
// English day traffic floated. Real overcast light is a bright dome: under a car there is a dark patch that fades out
// a hand's breadth beyond the sills, under a person a small soft one round the feet. This draws exactly that for the
// things inside the sun's shadow box (world/blobs.js does the round stand-in shadows beyond it, as before), from the
// same registry (world.blobShadow), in ONE instanced draw, at a strength that follows how diffuse the light is: nothing
// in clear sun (the shadow map is the shadow there), full under an overcast, a little at night under the lamps.
import * as THREE from 'three';

const MAX = 64;

function shadeTexture() {
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), im = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // dark under the body (r < 0.5), gone by the rim: a smooth shoulder, not a cone
    const r = Math.hypot((x + 0.5) / N * 2 - 1, (y + 0.5) / N * 2 - 1), t = Math.min(1, Math.max(0, (1 - r) / 0.55)), v = t * t * (3 - 2 * t);
    im.data[(y * N + x) * 4] = im.data[(y * N + x) * 4 + 1] = im.data[(y * N + x) * 4 + 2] = Math.round(255 * v); im.data[(y * N + x) * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function createContact(game, scene, blobs) {
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadeTexture(), transparent: true, opacity: 0, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16, name: 'fx:contactShade' });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.renderOrder = 1; mesh.name = 'world:fxContact'; mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), wp = new THREE.Vector3();
  const C = { enabled: false, mesh, shown: 0, k: 0 };
  const inWorld = (o) => { for (let a = o; a; a = a.parent) { if (!a.visible) return false; if (a === scene) return true; } return false; };
  let self = null;
  /** once a frame outdoors. shadowK: the sun's shadow strength 0..1 (sky.sun.shadow.intensity), night 0..1 */
  C.update = (shadowK, night) => {
    let n = 0;
    const k = C.enabled && game.scene === scene ? 0.45 * (1 - shadowK) * (1 - 0.35 * night) + 0.16 * night * shadowK : 0;
    C.k = k;
    if (k > 0.02) {
      const list = blobs.list, pl = game.player.pos, inner = blobs.inner, lim = (inner + 8) * (inner + 8);
      mat.opacity = k;
      if (!self && game.player.character && game.player.character.group) self = { obj: game.player.character.group, r: 0.38, stretch: 1, y: null };
      for (let i = -1; i < list.length && n < MAX; i++) {
        const e = i < 0 ? self : list[i]; if (!e) continue;
        const o = e.obj;
        if (i < 0 && game.player.vehicle) continue;
        if (!inWorld(o)) continue;
        wp.setFromMatrixPosition(o.matrixWorld);
        const dx = wp.x - pl.x, dz = wp.z - pl.z, d2 = dx * dx + dz * dz;
        if (d2 > lim) continue;
        // (hands over to the round stand-in of world/blobs.js across the edge of the shadow box)
        const fade = 1 - Math.min(1, Math.max(0, (Math.sqrt(d2) - inner) / 8));
        const el = o.matrixWorld.elements;
        q.setFromAxisAngle(up, Math.atan2(el[8], el[10]));
        // a vehicle (stretch > 1): its plan plus a hand's breadth; a person: a patch round the feet
        const w = e.stretch > 1.2 ? e.r * 2.15 : e.r * 2.5;
        s.set(w * fade, 1, w * e.stretch * (e.stretch > 1.2 ? 1.06 : 1) * fade);
        p.set(wp.x, (e.y ?? wp.y) + 0.035, wp.z);
        m4.compose(p, q, s);
        mesh.setMatrixAt(n++, m4);
      }
    }
    if (n || C.shown) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; }
    mesh.visible = n > 0; C.shown = n;
  };
  return C;
}
