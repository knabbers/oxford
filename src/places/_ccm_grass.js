// Christ Church Meadow — the long grass of the grazed fields near the camera (medium / high tiers): ONE InstancedMesh of
// crossed alpha-tested cards, 0.3-0.75 m tall (grass going to seed, sorrel, buttercups, the odd thistle), placed on a
// jittered 1.1 m grid inside the fields only, refilled when the camera has moved 5 m. Positions are a hash of the grid
// cell, so the same tussock is always in the same place. No shadows; the ground's meadow cell does the rest.
import * as THREE from 'three';
import { pointInPoly, distToPoly } from './_ccm_map.js';

const STEP = 1.1, MOVE = 5;
const hc = (i, j, k) => { let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(k | 0, 0x9e3779b1); h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

function grassTexture() {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 23; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 150; i++) {
    const x = r() * W, h = H * (0.3 + r() * 0.68), lean = (r() - 0.5) * 30, t = 0.7 + r() * 0.45, dry = r() < 0.35;
    g.strokeStyle = dry ? `rgb(${Math.round(182 * t)},${Math.round(170 * t)},${Math.round(104 * t)})` : `rgb(${Math.round(118 * t)},${Math.round(158 * t)},${Math.round(66 * t)})`;
    g.lineWidth = 1 + r() * 1.5;
    g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h); g.stroke();
    if (r() < 0.22) { g.fillStyle = dry ? '#a99a68' : '#8e9a5a'; g.beginPath(); g.ellipse(x + lean, H - h + 5, 1.8, 6, 0, 0, Math.PI * 2); g.fill(); }   // seed heads
  }
  for (let i = 0; i < 9; i++) {   // buttercups, sorrel, a few clover heads
    const x = 8 + r() * (W - 16), y = H * (0.18 + r() * 0.5), k = r();
    g.fillStyle = k < 0.5 ? '#e9c624' : k < 0.8 ? '#9a3a26' : '#e8dce8';
    g.beginPath(); g.arc(x, y, k < 0.5 ? 2.6 : 2, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  return t;
}

/** fields: [poly, ...]; holes: [poly, ...]; opts {max, radius} -> {mesh, update(camX, camZ, force), count} */
export function createLongGrass(fields, holes, opts = {}) {
  const MAX = opts.max || 2400, R = opts.radius || 30;
  const pos = [], uv = [], nor = [];
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const cx = Math.cos(a) * 0.45, cz = Math.sin(a) * 0.45;
    const P = [[-cx, 0, -cz], [cx, 0, cz], [cx, 1, cz], [-cx, 1, -cz]], T = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const k of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { pos.push(...P[k]); uv.push(...T[k]); nor.push(0, 1, 0); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const mat = new THREE.MeshLambertMaterial({ map: grassTexture(), alphaTest: 0.45, name: 'ccm:longgrass' });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.count = 0; mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'ccm:longgrass'; mesh.visible = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  const bbs = fields.map((P) => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const [x, z] of P) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return [a, b, c, d]; });
  const inField = (x, z) => fields.some((P, i) => { const bb = bbs[i]; return x > bb[0] && x < bb[1] && z > bb[2] && z < bb[3] && pointInPoly(x, z, P) && distToPoly(x, z, P) > 0.6; }) && !holes.some((h) => pointInPoly(x, z, h));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let lx = 1e9, lz = 1e9;
  const out = {
    mesh, count: 0,
    update(cx, cz, force = false) {
      if (!force && Math.hypot(cx - lx, cz - lz) < MOVE) return;
      lx = cx; lz = cz;
      let n = 0;
      const i0 = Math.floor((cx - R) / STEP), i1 = Math.floor((cx + R) / STEP), j0 = Math.floor((cz - R) / STEP), j1 = Math.floor((cz + R) / STEP);
      for (let i = i0; i <= i1 && n < MAX; i++) for (let j = j0; j <= j1 && n < MAX; j++) {
        const x = (i + 0.15 + 0.7 * hc(i, j, 1)) * STEP, z = (j + 0.15 + 0.7 * hc(i, j, 2)) * STEP, d = Math.hypot(x - cx, z - cz);
        // clumpy: a slow two-octave pattern decides where the grass stands long, thinner towards the edge of the patch
        const patch = 0.5 + 0.3 * Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.sin(z * 0.09 + 1.3) + 0.2 * Math.sin(x * 0.37 + z * 0.29);
        const edge = Math.min(1, Math.max(0, (d - R * 0.5) / (R * 0.5)));
        if (d > R || hc(i, j, 7) > patch * 1.15 - edge * 0.45) continue;
        if (!inField(x, z)) continue;
        const h = (0.2 + 0.38 * hc(i, j, 3) * hc(i, j, 4) + 0.12 * hc(i, j, 5) + 0.15 * patch) * (1 - 0.55 * edge), w = 0.7 + 0.6 * hc(i, j, 6);
        q.setFromAxisAngle(up, hc(i, j, 8) * 6.283); m.compose(v.set(x, 0.01, z), q, sc.set(w, h, w)); mesh.setMatrixAt(n, m);
        const k = 0.95 + 0.25 * hc(i, j, 9); mesh.instanceColor.setXYZ(n, k, k * (0.97 + 0.06 * hc(i, j, 10)), k * 0.95);
        n++;
      }
      mesh.count = n; out.count = n;
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
  };
  return out;
}
