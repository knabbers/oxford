// Grass tufts and daisies near the camera on rough grass ('high' tier only, graphics pass 2): ONE InstancedMesh of
// crossed alpha-tested cards, refilled when the camera has moved a few metres. Only on park / meadow / garden / town
// grass areas (not on college lawns or pitches, which are mown), never on paths, roads or under buildings.
import * as THREE from 'three';
import { pointInPoly, polyBounds, distToSeg } from './util.js';

/** integer hash -> [0,1) (no strings: called a few thousand times per refill) */
const hash01 = (n) => { let h = (n | 0) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

const R = 21, STEP = 0.75, MAX = 3200, CELL = 2, MOVE = 4;
// (flora pass, 2026-11: tufts stood on the University Parks pond and on paths; ?flora=0 / GTO_FLORA=0 = as before)
const FLORA_FIX = !((typeof location !== 'undefined' && location && /[?&]flora=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_FLORA === '0'));
const ROUGH = new Set(['park', 'meadow', 'garden', 'grass']);
const BLOCK = new Set(['pitch', 'paved', 'parking', 'flowerbed', 'sand', 'bridge', 'pier', 'water']);

function tuftTexture() {
  const W = 128, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 70; i++) {
    const x = r() * W, h = H * (0.35 + r() * 0.6), lean = (r() - 0.5) * 18, w = 1.2 + r() * 1.8;
    const t = 0.75 + r() * 0.35;
    g.strokeStyle = `rgb(${Math.round(96 * t)},${Math.round(150 * t)},${Math.round(52 * t)})`; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h); g.stroke();
  }
  // a few daisies and buttercups
  for (let i = 0; i < 4; i++) {
    const x = 10 + r() * (W - 20), y = H * (0.25 + r() * 0.4), yellow = r() < 0.3;
    g.fillStyle = yellow ? '#e8c830' : '#f6f4ee';
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.6, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#e0b020'; g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  return t;
}

export function createTufts(ctx, game, scene) {
  // crossed cards 0.55 m wide x 0.22 m tall, origin at the base; normals point up so they light like the ground
  const pos = [], uv = [], nor = [];
  for (const a of [0, Math.PI / 2]) {
    const cx = Math.cos(a) * 0.275, cz = Math.sin(a) * 0.275;
    const P = [[-cx, 0, -cz], [cx, 0, cz], [cx, 0.22, cz], [-cx, 0.22, -cz]], T = [[0, 0], [1, 0], [1, 1], [0, 1]];
    // both windings, front-sided, normals up: no dark back faces (DoubleSide would flip the normal)
    for (const k of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { pos.push(...P[k]); uv.push(...T[k]); nor.push(0, 1, 0); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const mat = new THREE.MeshStandardMaterial({ map: tuftTexture(), alphaTest: 0.45, roughness: 1, name: 'tufts' });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.count = 0; mesh.visible = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'world:tufts';
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  scene.add(mesh);

  // areas on a 100 m grid
  const G = 100, grid = new Map(), key = (i, j) => i * 65536 + j;
  for (const it of ctx.areaList || []) {
    const k = it.a.kind;
    const rough = ROUGH.has(k) && !(k === 'grass' && ctx.inCollege(it.cx, it.cz)), block = BLOCK.has(k);
    if (!rough && !block) continue;
    const bb = polyBounds(it.poly), rec = { poly: it.poly, holes: it.holes, bb, rough };
    for (let i = Math.floor(bb.minX / G); i <= Math.floor(bb.maxX / G); i++) for (let j = Math.floor(bb.minZ / G); j <= Math.floor(bb.maxZ / G); j++) {
      const kk = key(i, j); let a = grid.get(kk); if (!a) grid.set(kk, (a = [])); a.push(rec);
    }
  }
  const inside = (r, x, z) => x >= r.bb.minX && x <= r.bb.maxX && z >= r.bb.minZ && z <= r.bb.maxZ && pointInPoly(x, z, r.poly) && !r.holes.some((h) => pointInPoly(x, z, h));
  const cache = new Map();
  function grassy(x, z) {
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL), ck = ci * 100003 + cj;
    let v = cache.get(ck);
    if (v !== undefined) return v;
    const cx = (ci + 0.5) * CELL, cz = (cj + 0.5) * CELL;
    v = false;
    const list = grid.get(key(Math.floor(cx / G), Math.floor(cz / G)));
    if (list) {
      let rough = false, block = false;
      for (const r of list) if (inside(r, cx, cz)) { if (r.rough) rough = true; else block = true; }
      v = rough && !block;
    }
    if (v && ctx.roadGrid) ctx.roadGrid.queryRadius(cx, cz, 9, (it) => { if (distToSeg(cx, cz, it.ax, it.az, it.bx, it.bz) < it.w / 2 + 1.2) { v = false; return true; } });
    if (v && ctx.buildingGrid) ctx.buildingGrid.queryRadius(cx, cz, 2, (it) => { const bb = it.bb; if (cx > bb.minX - 1.5 && cx < bb.maxX + 1.5 && cz > bb.minZ - 1.5 && cz < bb.maxZ + 1.5) { v = false; return true; } });
    // [flora pass] not on water a place module added (the Parks' pond), nor over its edge
    if (v && FLORA_FIX) { const C = game.worldCollider; if (C && C.isWater && (C.isWater(cx, cz) || C.isWater(cx - 1, cz - 1) || C.isWater(cx + 1, cz - 1) || C.isWater(cx - 1, cz + 1) || C.isWater(cx + 1, cz + 1))) v = false; }
    if (cache.size > 60000) cache.clear();
    cache.set(ck, v);
    return v;
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  let lx = 1e9, lz = 1e9;
  const T = {
    enabled: false, mesh,
    refresh(cx, cz, force = false) {
      if (!T.enabled || game.scene !== scene) { if (mesh.visible) mesh.visible = false; return; }
      if (!force && Math.abs(cx - lx) < MOVE && Math.abs(cz - lz) < MOVE) { mesh.visible = mesh.count > 0; return; }
      lx = cx; lz = cz;
      let n = 0;
      const i0 = Math.floor((cx - R) / STEP), i1 = Math.floor((cx + R) / STEP), j0 = Math.floor((cz - R) / STEP), j1 = Math.floor((cz + R) / STEP);
      for (let i = i0; i <= i1 && n < MAX; i++) for (let j = j0; j <= j1 && n < MAX; j++) {
        const h = hash01(i * 7919 + j * 104729);
        if (h > 0.45) continue;                                     // patchy
        const x = (i + hash01(i * 31 + j * 17 + 5)) * STEP, z = (j + hash01(i * 13 + j * 37 + 9)) * STEP;
        const dx = x - cx, dz = z - cz, d = Math.sqrt(dx * dx + dz * dz);
        if (d > R || !grassy(x, z)) continue;
        if (FLORA_FIX && ctx.groundHeight) { const gh = ctx.groundHeight(x, z); if (gh > 0.032 || gh < -0.05) continue; }      // [flora pass] nor on a path, a road or a pavement; nor (2026-11-22) over ground sunk below y 0 (a tuft stands at y 0.012: it would hover over a sunk court)
        const k = Math.min(1, (R - d) / 5) * (0.7 + 0.6 * hash01(i * 3 + j * 11));
        q.setFromAxisAngle(up, h * 40);
        p.set(x, 0.012, z); s.set(k, k * (0.8 + 0.5 * h), k);
        m4.compose(p, q, s); mesh.setMatrixAt(n, m4);
        const t = 0.82 + 0.3 * hash01(i * 5 + j * 3);
        col.setRGB(t * 0.95, t, t * 0.85); mesh.setColorAt(n, col);
        n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      mesh.visible = n > 0;
    },
    set(on) { T.enabled = !!on; if (!on) { mesh.visible = false; mesh.count = 0; lx = lz = 1e9; } },
  };
  return T;
}
