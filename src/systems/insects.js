// Insects (2026-11 flora pass): butterflies, bees, hoverflies, dragonflies and a dusk cloud of midges, working the
// flowers that systems/flora.js has planted near the camera. Who flies when, and how each moves, is _insects_logic.js
// (pure). Here: ONE instanced draw ('insects') — two hinged wing cards and a crossed body card per insect, the wing
// beat in the vertex shader, a 256 px sheet painted on a canvas — and the per-frame step (at most 44 insects, struct of
// arrays, nothing allocated). Local to each player and purely visual: no network, no collision, no sound (the ambience
// system has no free hook for a hum: left alone). Only outdoors, by day, in fair weather warm enough for the species;
// the moths round the street lamps at night are systems/streetscape.js's.
//   quality   at most 10 / 20 / 34 / 44 insects on low / medium / high / ultra
//   switch    ?insects=0 (node GTO_INSECTS=0); ?flora=0 also leaves them with no flowers, so none appear
//   API       game.insects = { on, mesh, count, swarm, env, stats(), species }
import * as THREE from 'three';
import { SPECIES, INSECT_TIERS, MAX_INSECTS, createSwarm, anyActive } from './_insects_logic.js';

export const INSECTS = !((typeof location !== 'undefined' && location && /[?&]insects=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_INSECTS === '0'));
const GRID = 4, PX = 64;

function paint(g) {
  const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); };
  const blob = (x, y, rx, ry, fill, rot = 0) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 6.2832); g.fill(); };
  // wing half: x 0 (hinge) .. 32 (tip), y 0 (front) .. 64; body half: centred on x = 48
  const fore = (c) => poly([[0, 22], [10, 6], [27, 3], [31, 10], [28, 24], [14, 33], [0, 33]], c);
  const hind = (c) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, 31); g.lineTo(16, 30); g.quadraticCurveTo(29, 34, 26, 48); g.quadraticCurveTo(18, 60, 6, 54); g.lineTo(0, 44); g.closePath(); g.fill(); };
  const body = (c, len = 44, w = 3.2) => { blob(48, 32, w, len / 2, c); blob(48, 32 - len / 2 + 2, w * 1.1, 3.2, c); g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(47, 12); g.lineTo(43, 3); g.moveTo(49, 12); g.lineTo(53, 3); g.stroke(); };
  const paleWing = (len, c = 'rgba(206,214,222,1)') => { blob(len * 0.5, 27, len * 0.5, 6.5, c, -0.25); blob(len * 0.38, 37, len * 0.38, 5, c, 0.2); g.strokeStyle = 'rgba(120,128,140,1)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(1, 30); g.lineTo(len * 0.9, 24); g.stroke(); };
  const stripes = (cols, y0, y1, w) => { const n = cols.length; for (let i = 0; i < n; i++) { const ya = y0 + (y1 - y0) * i / n, yb = y0 + (y1 - y0) * (i + 1) / n, t = (i + 0.5) / n, ww = w * Math.sin(Math.PI * (0.12 + 0.82 * t)); g.fillStyle = cols[i]; g.beginPath(); g.ellipse(48, (ya + yb) / 2, ww, (yb - ya) * 0.62, 0, 0, 6.2832); g.fill(); } };
  const cells = [
    () => { fore('#f3f1e6'); hind('#efeede'); poly([[20, 4], [27, 3], [31, 10], [29, 15]], '#2e2e30'); blob(17, 18, 2.2, 2.2, '#3a3a3c'); body('#55524a'); },
    () => { poly([[0, 22], [9, 7], [24, 3], [31, 7], [27, 23], [14, 33], [0, 33]], '#e6de52'); g.fillStyle = '#ded64e'; g.beginPath(); g.moveTo(0, 31); g.lineTo(16, 30); g.quadraticCurveTo(30, 36, 24, 48); g.lineTo(26, 54); g.quadraticCurveTo(14, 58, 6, 53); g.lineTo(0, 44); g.closePath(); g.fill(); blob(17, 17, 1.6, 1.6, '#d08a2a'); blob(15, 43, 1.6, 1.6, '#d08a2a'); body('#6a6840'); },
    () => { fore('#f2f0e8'); hind('#dfe2d2'); poly([[16, 5], [27, 3], [31, 10], [28, 24], [21, 28]], '#e8902c'); poly([[25, 3], [31, 6], [31, 12]], '#3a3632'); for (const [x, y] of [[8, 40], [16, 37], [20, 46], [11, 50], [17, 53]]) blob(x, y, 2.6, 2, '#9aa684'); body('#4c4a46'); },
    () => { fore('#8e2f22'); hind('#7e2a20'); poly([[0, 22], [10, 6], [27, 3], [22, 7], [8, 12]], '#2a1c18'); blob(25, 10, 5, 5, '#d8c060'); blob(25, 10, 3.2, 3.2, '#3848a0'); blob(25, 10, 1.4, 1.4, '#181828'); blob(19, 46, 4.6, 4.6, '#c8c6d8'); blob(19, 46, 3, 3, '#3040a0'); blob(19, 46, 1.3, 1.3, '#101020'); g.strokeStyle = '#3a2018'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(31, 10); g.lineTo(28, 24); g.lineTo(14, 33); g.stroke(); body('#33261e'); },
    () => { fore('#231c1a'); hind('#261e1a'); g.strokeStyle = '#dc4a26'; g.lineWidth = 4.2; g.beginPath(); g.moveTo(8, 9); g.quadraticCurveTo(20, 16, 20, 31); g.stroke(); g.beginPath(); g.moveTo(8, 55); g.quadraticCurveTo(22, 56, 27, 44); g.stroke(); for (const [x, y] of [[23, 7], [27, 10], [19, 5], [26, 15]]) blob(x, y, 1.7, 1.7, '#f2f0ea'); body('#1c1614'); },
    () => { fore('#6c84dc'); hind('#6880d8'); g.strokeStyle = '#2a2c40'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(10, 6); g.lineTo(27, 3); g.lineTo(31, 10); g.lineTo(28, 24); g.moveTo(16, 30); g.quadraticCurveTo(29, 34, 26, 48); g.quadraticCurveTo(18, 60, 6, 54); g.stroke(); body('#5a6480', 40, 2.6); },
    () => { paleWing(22); stripes(['#1c1a18', '#e0b020', '#1c1a18', '#1c1a18', '#e0b020', '#1c1a18', '#efe9dc'], 10, 56, 10); blob(48, 9, 5, 4, '#14120f'); },
    () => { paleWing(22); stripes(['#3a2c1c', '#8a6a34', '#c89a44', '#3a2c1c', '#c89a44', '#3a2c1c', '#b88c40', '#3a2c1c'], 12, 58, 6.4); blob(48, 10, 4, 3.6, '#2a2018'); },
    () => { paleWing(26, 'rgba(214,220,226,1)'); stripes(['#2a2622', '#2a2622', '#e2c02c', '#1c1a18', '#e2c02c', '#1c1a18', '#e2c02c', '#1c1a18'], 14, 58, 5.2); blob(48, 11, 5, 4.4, '#6a2a20'); },
    () => { for (const [y, r] of [[22, -0.12], [34, 0.1]]) { blob(16.5, y, 15.5, 3.6, 'rgba(196,208,220,1)', r); g.strokeStyle = 'rgba(96,104,118,1)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(1, y + 1); g.lineTo(31, y + r * 26); g.stroke(); blob(28, y + r * 22, 2.2, 1.3, '#3a3a44', r); } blob(48, 12, 4.6, 4, '#3c7a54'); blob(48, 20, 3.8, 6, '#2e6a70'); for (let i = 0; i < 9; i++) blob(48, 28 + i * 3.8, 1.9 - i * 0.07, 2.1, i % 2 ? '#2a74b8' : '#1e4a78'); },
    () => { for (const [y, r] of [[23, -0.5], [28, -0.36]]) blob(15, y - 3, 14, 2.4, 'rgba(176,186,196,1)', r); blob(48, 10, 3.2, 2.8, '#2a6aa8'); blob(48, 16, 2.4, 4, '#2260a0'); for (let i = 0; i < 11; i++) blob(48, 22 + i * 3.6, 1.25, 1.9, i % 3 === 2 ? '#14181c' : '#38a0e0'); },
    () => { let s = 77; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let i = 0; i < 15; i++) { const r = 1.7 + R() * 0.7; blob(35 + R() * 26, 4 + R() * 56, r, r, '#2c2a26'); } },
  ];
  cells.forEach((fn, i) => { g.save(); g.beginPath(); g.rect((i % GRID) * PX + 1, Math.floor(i / GRID) * PX + 1, PX - 2, PX - 2); g.clip(); g.translate((i % GRID) * PX, Math.floor(i / GRID) * PX); fn(); g.restore(); });
}
function texture() {
  const W = GRID * PX, c = document.createElement('canvas'); c.width = W; c.height = W;
  const g = c.getContext('2d', { willReadFrequently: true });
  paint(g);
  let data = null;
  try { const im = g.getImageData(0, 0, W, W); if (im && im.data && im.data.length === W * W * 4) data = new Uint8Array(im.data.buffer.slice(0)); } catch (e) { /* headless */ }
  if (!data) data = new Uint8Array(W * W * 4);
  // transparent texels take the mean colour of their cell, so the cut-out edge has no dark fringe
  for (let cy = 0; cy < GRID; cy++) for (let cx = 0; cx < GRID; cx++) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) { const o = ((cy * PX + y) * W + cx * PX + x) * 4; if (data[o + 3] > 200) { r += data[o]; gg += data[o + 1]; b += data[o + 2]; n++; } }
    if (!n) continue; r /= n; gg /= n; b /= n;
    for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) { const o = ((cy * PX + y) * W + cx * PX + x) * 4, a = data[o + 3] / 255; if (a < 1) { data[o] = data[o] * a + r * (1 - a); data[o + 1] = data[o + 1] * a + gg * (1 - a); data[o + 2] = data[o + 2] * a + b * (1 - a); } }
  }
  const t = new THREE.DataTexture(data, W, W, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; t.name = 'insects:sheet';
  return t;
}
function geometry(cap) {
  const g = new THREE.InstancedBufferGeometry(), P = [], UV = [], PT = [], IX = [];
  const quad = (pts, uvs, part) => { const b = P.length / 3; for (let i = 0; i < 4; i++) { P.push(...pts[i]); UV.push(...uvs[i]); PT.push(part); } IX.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  // wings: x = distance out from the hinge (0..1), z along the body (+z = ahead); texture: left half of the cell, front at v = 0
  // (the shader reads only x and z of a wing vertex; the left wing's y is set apart so that the two unhinged cards are
  // not one on top of the other in the raw geometry: tools/audit_zfight.mjs)
  for (const s of [1, -1]) { const y = s > 0 ? 0 : -0.08; quad([[0, y, -0.5], [1, y, -0.5], [1, y, 0.5], [0, y, 0.5]], [[0, 1], [0.5, 1], [0.5, 0], [0, 0]], s); }
  // body: a flat card and an upright one, the right half of the cell
  quad([[-0.25, 0.04, -0.5], [0.25, 0.04, -0.5], [0.25, 0.04, 0.5], [-0.25, 0.04, 0.5]], [[0.5, 1], [1, 1], [1, 0], [0.5, 0]], 0);
  quad([[0, -0.25, -0.5], [0, 0.25, -0.5], [0, 0.25, 0.5], [0, -0.25, 0.5]], [[0.5, 1], [1, 1], [1, 0], [0.5, 0]], 0);
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('aPart', new THREE.Float32BufferAttribute(PT, 1));
  g.setIndex(IX);
  for (const n of ['aI0', 'aI1', 'aI2']) { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); }
  g.instanceCount = 1;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2900); g.boundingBox = new THREE.Box3(new THREE.Vector3(-2900, -10, -2900), new THREE.Vector3(2900, 60, 2900));
  return g;
}
/** aI0 = x, y, z, heading; aI1 = size, flap rate (rad/s), flap swing, wing rest angle; aI2 = sheet cell, phase, fade, 0 */
function material(timeUniform) {
  const U = { uTime: timeUniform || { value: 0 }, uILight: { value: 1 } };
  const m = new THREE.MeshBasicMaterial({ map: texture(), alphaTest: 0.4, side: THREE.DoubleSide, name: 'insects' });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uILight = U.uILight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aI0;\nattribute vec4 aI1;\nattribute vec4 aI2;\nattribute float aPart;\nuniform float uTime;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
	vMapUv = vec2((mod(aI2.x, ${GRID}.0) + 0.02 + uv.x * 0.96) / ${GRID}.0, (floor(aI2.x / ${GRID}.0) + 0.02 + uv.y * 0.96) / ${GRID}.0);`)
      .replace('#include <begin_vertex>', `
	float iAng = aI1.w + aI1.z * sin(uTime * aI1.y + aI2.y);
	vec3 il = position;
	if (abs(aPart) > 0.5) il = vec3(aPart * position.x * cos(iAng), position.x * sin(iAng), position.z);
	il *= aI1.x * aI2.z * (1.0 - smoothstep(30.0, 40.0, distance(aI0.xz, cameraPosition.xz)));
	float ic = cos(aI0.w), is = sin(aI0.w);
	vec3 transformed = vec3(il.x * ic + il.z * is, il.y, il.z * ic - il.x * is) + aI0.xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uILight;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= uILight;');
  };
  m.customProgramCacheKey = () => 'insects1';
  m.userData.uniforms = U;
  return m;
}

export default {
  id: 'insects',
  install(game) {
    if (!INSECTS) { game.insects = { on: false, count: 0, stats: () => ({ on: false }) }; return null; }
    const world = game.world, scene = game.worldScene;
    const geo = geometry(MAX_INSECTS), mat = material(world.uniforms && world.uniforms.time), mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'insects'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    const A0 = geo.attributes.aI0, A1 = geo.attributes.aI1, A2 = geo.attributes.aI2, a0 = A0.array, a1 = A1.array, a2 = A2.array;
    const swarm = createSwarm((Math.random() * 1e9) | 0);
    const env = { daylight: 1, hour: 12, rain: 0, tempC: 10, wind: 0, fog: 0 };
    const NOF = { n: 0, a: new Float32Array(4) };
    let shown = true, drawn = 0, forced = null;
    const flush = (k) => {
      if (k === 0) { a1[0] = 0; a2[2] = 0; k = 1; drawn = 0; } else drawn = k;
      geo.instanceCount = k;
      for (const a of [A0, A1, A2]) { a.clearUpdateRanges(); a.addUpdateRange(0, k * 4); a.needsUpdate = true; }
    };
    flush(0);
    game.insects = {
      on: true, mesh, swarm, env, species: SPECIES,
      /** tests / screenshots: pin parts of the weather the insects see ({tempC, rain, daylight, wind, fog, hour}); null = the real weather again */
      force(o) { forced = o || null; },
      get count() { return swarm.count; },
      stats: () => ({ on: true, count: swarm.count, drawn, byGroup: Array.from(swarm.byGroup), want: Array.from(swarm.want), nectar: swarm.nectar, water: swarm.wet, env: { ...env }, active: anyActive(swarm.act) }),
    };
    const UPD = [A0, A1, A2];
    return {
      update(dt) {
        // (never hidden: see systems/flora.js)
        const out = game.scene === scene && !(world.aerial && game.camera.position.y > 40);
        if (out !== shown) { shown = out; if (!out) { swarm.clear(); flush(0); } }
        if (!out) return;
        const T = game.time, w = game.weather;
        env.daylight = T && Number.isFinite(T.daylight) ? T.daylight : 1; env.hour = T ? T.hour : 12;
        env.rain = w && w.rain > 0 ? w.rain : 0; env.tempC = w && Number.isFinite(w.tempC) ? w.tempC : 10; env.wind = w && w.wind ? w.wind.speed || 0 : 0; env.fog = w && w.fog > 0 ? w.fog : 0;
        if (forced) Object.assign(env, forced);
        const F = (game.flora && game.flora.on && game.flora.flowers) || NOF, c = game.camera.position, p = game.player && game.player.pos ? game.player.pos : c;
        // nothing flying and nothing that could: a few comparisons a frame
        if (swarm.count === 0 && F.n === 0) { if (drawn) flush(0); return; }
        const q = game.quality, cap = (q && INSECT_TIERS[q.level]) || INSECT_TIERS.medium;
        swarm.step(dt, F, env, cap, c.x, c.z, p.x, p.z);
        let k = 0;
        for (let i = 0; i < swarm.N; i++) {
          const sp = swarm.sp[i]; if (sp < 0) continue;
          const o = k * 4, s = SPECIES[sp];
          a0[o] = swarm.x[i]; a0[o + 1] = swarm.y[i]; a0[o + 2] = swarm.z[i]; a0[o + 3] = swarm.h[i];
          a1[o] = s.size; a1[o + 1] = swarm.freq[i]; a1[o + 2] = swarm.amp[i]; a1[o + 3] = swarm.base[i];
          a2[o] = s.cell; a2[o + 1] = swarm.ph[i]; a2[o + 2] = swarm.fade[i]; a2[o + 3] = 0;
          k++;
        }
        if (k === 0) { if (drawn) flush(0); return; }
        drawn = k; geo.instanceCount = k;
        for (let j = 0; j < 3; j++) { const a = UPD[j]; a.clearUpdateRanges(); a.addUpdateRange(0, k * 4); a.needsUpdate = true; }
        mat.userData.uniforms.uILight.value = 0.3 + 0.7 * env.daylight;
      },
    };
  },
};
