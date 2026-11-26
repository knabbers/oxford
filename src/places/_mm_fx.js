// May Morning — what is drawn. No lights are added to the scene; nothing here runs unless the event is on and near.
//   lookFor(kind, seed)        the look of one member of the crowd (the same list dresses cut-outs, stand-ins, live people)
//   createCrowd(spots)         ONE instanced draw of people cut-outs. Unlike the fireworks crowd each figure has a FRONT and
//                              a BACK painting and shows the right one for where the camera stands relative to the way the
//                              figure faces (everyone faces the tower), and is lit by the sky and the low sun.
//   createStandins(spots, n)   the people nearest the camera as real 3D figures: the game's own character bodies, posed
//                              looking up, baked to static geometry and instanced (one draw per variant, shared character
//                              material). The cut-outs they replace are switched off, so close up the crowd has depth.
//   createChoir()              the choir on the tower: two instanced baked figures (boy choristers, men), surplices
//   createDressing(plan)       ONE draw: crowd barriers and ROAD CLOSED boards (alpha-tested canvas texture)
import * as THREE from 'three';
import { createCharacter, randomLook, bakeCharacterGeometry, characterMaterial } from '../core/characters.js';
import { KINDS, SITE, hash } from './_mm_rules.js';

// ------------------------------------------------------------------------------------------------ who they are
const DRESS = [0x7a1f2e, 0x1f3a6a, 0x2a6a4a, 0xb8963a, 0x5a2a6a, 0xa02848, 0x1a1a1e, 0xc8c0b0];
const COATS = [0x3a4a6a, 0x6a2a2a, 0x2f4a3a, 0x55504a, 0x1f2430, 0x7a5a2a, 0x4a3a5a, 0x2a5a6a];
const BLOOM = [0xf0a0c0, 0xf4e060, 0xffffff, 0xe86a8a, 0xb890e0];
export function lookFor(kind, seed) {
  const k = KINDS[kind] || 'student', r = (j) => hash(seed * 1.37 + 3, j), pick = (a, j) => a[Math.floor(r(j) * a.length) % a.length];
  switch (k) {
    // after the all-night balls: dinner jackets with the bow tie undone, gowns with the shoes in one hand
    case 'blacktie': case 'blacktie2': return randomLook(seed, { outfit: 'clubbing', theme: 'black-tie', range: 'mens', state: k === 'blacktie' ? 0.45 : 0.68, skimpy: 0 });
    case 'gown': case 'gown2': { const L = randomLook(seed, { outfit: 'clubbing', theme: 'black-tie', range: 'womens', state: k === 'gown' ? 0.4 : 0.7, skimpy: 0 }); if (L.club) { L.club.dress = 'maxi'; L.club.c = { ...(L.club.c || {}), main: pick(DRESS, 1) }; } return L; }
    case 'flowers': case 'flowers2': return { ...randomLook(seed, { outfit: 'casual' }), figure: 'f', hairStyle: r(2) < 0.5 ? 'long' : 'curls', hat: 'laurel', hatColor: pick(BLOOM, 3), skirt: k === 'flowers' ? 'long' : 'knee', dress: true, top: pick([0xe8e0d0, 0x9ab87a, 0xd8a0b0, 0x7a9ac8], 4), topStyle: 'tee', shoeStyle: 'boot' };
    case 'greenman': return { ...randomLook(seed, { outfit: 'casual' }), figure: 'm', skin: 0x5c8a44, hair: 0x2f5a22, hairStyle: 'grey-wild', beard: 'long', hat: 'laurel', hatColor: 0x3f7a2a, top: 0x35682a, topStyle: 'jumper', tartan: 0x1f4a1a, bottom: 0x2a4a22, legs: 'trousers', jacket: 0x2f5a25, jacketLen: 'long', shoes: 0x2a2a1a, shoeStyle: 'boot', build: 1.15 };
    case 'tweed': return { ...randomLook(seed, { outfit: 'tweed' }), hat: 'flatcap', hatColor: 0x5a5040 };
    case 'tourist': return { ...randomLook(seed, { outfit: 'tourist' }), camera: true };
    case 'coat': return { ...randomLook(seed, { outfit: 'casual' }), jacket: pick(COATS, 5), jacketLen: 'long', scarf: r(6) < 0.5 ? [0x1a2a5a, 0xe8e0c8] : null, hat: r(7) < 0.3 ? 'beanie' : null, hatColor: 0x8a2a2a };
    case 'coatF': return { ...randomLook(seed, { outfit: 'casual' }), figure: 'f', hairStyle: 'bob', jacket: pick(COATS, 5), jacketLen: 'long', scarf: [0x8a2a3a, 0xe8d8b0] };
    case 'family': return { ...randomLook(seed, { outfit: 'casual' }), jacket: pick(COATS, 8), jacketLen: 'hip', backpack: r(9) < 0.5 ? 0x3a5a8a : null };
    case 'child': return { ...randomLook(seed, { outfit: 'casual' }), topStyle: 'hoodie', top: pick([0xd04040, 0x40a0d0, 0xe0c030, 0x60b060], 10), hat: r(11) < 0.4 ? 'beanie' : null, hatColor: 0xe07020, build: 0.85 };
    case 'studentF': return { ...randomLook(seed, { outfit: 'casual' }), figure: 'f', hairStyle: r(2) < 0.5 ? 'ponytail' : 'long', topStyle: 'jumper', scarf: r(6) < 0.6 ? [0x1a2a5a, 0xc8a030] : null };
    case 'hoodie': return { ...randomLook(seed, { outfit: 'casual' }), topStyle: 'hoodie' };
    default: return { ...randomLook(seed, { outfit: 'casual' }), topStyle: 'jumper', scarf: r(6) < 0.5 ? [0x5a1a2a, 0xe8e0c8] : null };
  }
}

// ------------------------------------------------------------------------------------------------ cut-outs
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const shade = (n, f) => { const r = Math.min(255, ((n >> 16) & 255) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0; return `rgb(${r},${g},${b})`; };
const SKIN = [0xe0b898, 0xc89070, 0xf0c8a8, 0x8a5a3a, 0xd8a888, 0x6a4028], HAIR = [0x3a2a1a, 0x7a5a30, 0x1a1a1a, 0x5a3a20, 0xc0a060, 0x2a2018, 0x8a3a18, 0x9a9088];
/** one figure, 96 x 192, feet at the bottom; back = seen from behind. Painted, not photographed: flat shapes with a shaded side. */
function paintFigure(g, kind, back) {
  const k = KINDS[kind], r = (j) => hash(kind * 7.13 + 1, j), pick = (a, j) => a[Math.floor(r(j) * a.length) % a.length];
  const cx = 48, fem = /gown|flowers|studentF|coatF/.test(k), skin = k === 'greenman' ? 0x5c8a44 : pick(SKIN, 1), hair = k === 'greenman' ? 0x2f5a22 : pick(HAIR, 2);
  const formal = /blacktie/.test(k), gown = /gown/.test(k), coat = /coat|tweed|greenman/.test(k);
  let top = formal ? 0x17171b : gown ? pick(DRESS, 3) : k === 'greenman' ? 0x35682a : k === 'tweed' ? 0x6a5a3a : k === 'flowers' || k === 'flowers2' ? pick([0xe8e0d0, 0x9ab87a, 0xd8a0b0], 3) : coat ? pick(COATS, 3) : pick([0x7a2a2a, 0x2a4a7a, 0x4a6a4a, 0x8a8a8a, 0xc0a040, 0x3a3a4a], 3);
  const legs = formal ? 0x131316 : k === 'greenman' ? 0x2a4a22 : pick([0x1c2030, 0x2a3a5a, 0x3a3026, 0x2a2a2a], 4);
  const w = fem ? 15 : 18, hip = 108, sh = 46;
  const rr = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
  // legs / skirt / gown
  if (gown || k === 'flowers') { g.fillStyle = hex(top); g.beginPath(); g.moveTo(cx - w + 2, 84); g.lineTo(cx + w - 2, 84); g.lineTo(cx + w + 9, 184); g.lineTo(cx - w - 9, 184); g.closePath(); g.fill(); g.fillStyle = shade(top, 0.72); g.beginPath(); g.moveTo(cx + 3, 90); g.lineTo(cx + w + 9, 184); g.lineTo(cx + 6, 184); g.closePath(); g.fill(); rr(cx - 9, 184, 7, 6, hex(skin)); rr(cx + 3, 184, 7, 6, hex(skin)); }
  else {
    const bare = k === 'flowers2' || (fem && r(5) < 0.4);
    rr(cx - 13, hip, 11, 72, bare ? hex(skin) : hex(legs)); rr(cx + 2, hip, 11, 72, bare ? shade(skin, 0.85) : shade(legs, 0.8));
    if (bare) { g.fillStyle = hex(top); g.beginPath(); g.moveTo(cx - w, 96); g.lineTo(cx + w, 96); g.lineTo(cx + w + 4, 136); g.lineTo(cx - w - 4, 136); g.closePath(); g.fill(); }
    rr(cx - 15, 179, 14, 10, '#15130f'); rr(cx + 1, 179, 14, 10, '#15130f');
  }
  // torso
  const len = coat ? 136 : 116;
  g.fillStyle = hex(top); g.beginPath(); g.moveTo(cx - w - 3, sh + 4); g.quadraticCurveTo(cx, sh - 9, cx + w + 3, sh + 4); g.lineTo(cx + w, gown ? 90 : len); g.lineTo(cx - w, gown ? 90 : len); g.closePath(); g.fill();
  g.fillStyle = shade(top, 0.74); g.fillRect(cx + w - 6, sh + 6, 6, (gown ? 88 : len) - sh - 8);
  // arms: 0 down, 1 one hand shading the eyes / phone up, 2 holding shoes
  const arm = k === 'tourist' ? 1 : /gown2|blacktie2/.test(k) ? 2 : 0, sleeve = gown || k === 'flowers' || k === 'flowers2' ? hex(skin) : hex(top);
  rr(cx - w - 9, sh + 4, 8, 58, sleeve); rr(cx - w - 9, sh + 60, 8, 8, hex(skin));
  if (arm === 1) { rr(cx + w + 1, 20, 8, 44, sleeve); rr(cx + w, 12, 11, 15, '#1c1c20'); }
  else { rr(cx + w + 1, sh + 4, 8, 58, gown ? shade(skin, 0.9) : shade(top, 0.85)); rr(cx + w + 1, sh + 60, 8, 8, hex(skin)); }
  if (arm === 2) { g.fillStyle = gown ? '#c8b060' : '#101012'; g.fillRect(cx + w + 1, sh + 68, 5, 15); g.fillRect(cx + w + 6, sh + 70, 5, 15); g.fillRect(cx + w - 1, sh + 82, 14, 4); }
  if (!back) {
    if (formal) { g.fillStyle = '#f2f0ea'; g.beginPath(); g.moveTo(cx - 8, sh - 3); g.lineTo(cx + 8, sh - 3); g.lineTo(cx, sh + 44); g.closePath(); g.fill(); g.fillStyle = '#0c0c0e'; if (k === 'blacktie') { g.fillRect(cx - 7, sh - 2, 14, 5); } else { g.fillRect(cx - 9, sh - 1, 4, 15); g.fillRect(cx + 5, sh - 1, 4, 13); } }
    else if (gown) { g.fillStyle = hex(skin); g.beginPath(); g.moveTo(cx - 13, sh - 4); g.lineTo(cx + 13, sh - 4); g.lineTo(cx, sh + 18); g.closePath(); g.fill(); }
    else if (k === 'tweed') { rr(cx - 5, sh - 3, 10, 30, '#e8e4d8'); rr(cx - 2, sh, 4, 26, '#7a2a2a'); }
    else if (coat) rr(cx - 1, sh, 2, len - sh - 2, 'rgba(0,0,0,0.3)');
    if (k === 'tourist') { rr(cx - 7, sh + 22, 14, 10, '#1a1a1c'); g.fillStyle = '#444'; g.beginPath(); g.arc(cx, sh + 27, 3.5, 0, 7); g.fill(); }
  } else {
    if (k === 'family' && r(9) < 0.99) { rr(cx - 11, sh + 6, 22, 34, '#3a5a8a'); rr(cx - 11, sh + 6, 22, 5, '#2a4a7a'); }
    if (gown) { g.fillStyle = hex(skin); g.beginPath(); g.moveTo(cx - 11, sh - 3); g.lineTo(cx + 11, sh - 3); g.lineTo(cx, sh + 26); g.closePath(); g.fill(); }
  }
  if (/coat|student$|studentF/.test(k) && r(6) < 0.75) { rr(cx - 12, sh - 7, 24, 8, kind % 2 ? '#8a2a3a' : '#1a2a5a'); if (!back) rr(cx + 3, sh - 2, 7, 26, kind % 2 ? '#e8d8b0' : '#c8a030'); }
  if (k === 'greenman') { for (let i = 0; i < 46; i++) { const a = r(20 + i) * 6.283, d = r(70 + i); g.fillStyle = ['#4f8a34', '#2f5a22', '#6aa040', '#3a6a28'][i % 4]; g.beginPath(); g.ellipse(cx + (d - 0.5) * 58, 34 + r(120 + i) * 106, 6, 3, a, 0, 7); g.fill(); } }
  // head: tipped back, looking up
  g.fillStyle = hex(skin); g.fillRect(cx - 4, 30, 8, 9);
  g.beginPath(); g.ellipse(cx, 22, 11, 13, 0, 0, 7); g.fill();
  g.fillStyle = hex(hair);
  if (back) { g.beginPath(); g.ellipse(cx, 21, 11.6, 13.4, 0, 0, 7); g.fill(); if (fem) g.fillRect(cx - 11.5, 20, 23, k === 'coatF' ? 14 : 30); }
  else {
    g.beginPath(); g.ellipse(cx, 17, 11.6, 9, 0, Math.PI, Math.PI * 2); g.fill(); g.fillRect(cx - 11.6, 14, 3.5, fem ? 30 : 9); g.fillRect(cx + 8.1, 14, 3.5, fem ? 30 : 9);
    g.fillStyle = 'rgba(30,18,12,0.75)'; g.fillRect(cx - 5.5, 19, 2.6, 2); g.fillRect(cx + 3, 19, 2.6, 2); g.fillStyle = 'rgba(120,40,40,0.55)'; g.fillRect(cx - 2.5, 28, 5, 1.6);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(cx + 5, 12, 6, 22);
    if (k === 'greenman' || (k === 'tweed' && r(12) < 0.6)) { g.fillStyle = k === 'greenman' ? '#2f5a22' : shade(hair, 1.1); g.beginPath(); g.ellipse(cx, 31, 9, 8, 0, 0, Math.PI); g.fill(); }
  }
  if (/flowers|greenman/.test(k) || (gown && r(13) < 0.35)) { for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI, x = cx + Math.cos(a) * 12, y = 13 + Math.sin(a) * 5; g.fillStyle = k === 'greenman' ? ['#4f8a34', '#6aa040'][i % 2] : hex(BLOOM[(i + kind) % BLOOM.length]); g.beginPath(); g.arc(x, y, 3.3, 0, 7); g.fill(); } }
  if (k === 'tweed') { g.fillStyle = '#5a5040'; g.beginPath(); g.ellipse(cx, 11, 13, 6, 0, Math.PI, Math.PI * 2); g.fill(); g.fillRect(cx - 13, 10, 26, 3); }
  if (k === 'child' || k === 'hoodie') { g.fillStyle = hex(top); g.fillRect(cx - 13, sh - 8, 26, 7); }
}
function crowdAtlas() {
  const W = 96, H = 192, c = document.createElement('canvas'); c.width = W * 16; c.height = H * 2;
  const g = c.getContext('2d');
  for (let k = 0; k < 16; k++) for (let b = 0; b < 2; b++) { g.save(); g.translate(k * W, b * H); paintFigure(g, k, b === 1); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  return t;
}
/** spots: [[x, z, kind, scale, phase, heading], ...] -> {mesh, u, n, setCount(k), hide(set of indices)} */
export function createCrowd(spots) {
  const n = spots.length, g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const P = new Float32Array(n * 3), D = new Float32Array(n * 4);
  spots.forEach((s, i) => { P[i * 3] = s[0]; P[i * 3 + 1] = s[1]; P[i * 3 + 2] = 1; D.set([s[2], s[3], s[4], s[5]], i * 4); });
  const iPos = new THREE.InstancedBufferAttribute(P, 3); iPos.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iPos', iPos); g.setAttribute('iData', new THREE.InstancedBufferAttribute(D, 4));
  g.instanceCount = 0;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(SITE.centre[0], 1, SITE.centre[1]), 260);
  const u = { uTime: { value: 0 }, uMap: { value: crowdAtlas() }, uAmb: { value: new THREE.Color(0.4, 0.42, 0.5) }, uSun: { value: new THREE.Color(0, 0, 0) }, uSunDir: { value: new THREE.Vector3(1, 0.1, 0) },
    uCheer: { value: 0 }, uFog: { value: new THREE.Color(0.7, 0.7, 0.75) }, uFogD: { value: 0.001 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, fog: false, side: THREE.DoubleSide,          // (the back view is the quad mirrored)
    vertexShader: /* glsl */`
      attribute vec3 iPos; attribute vec4 iData;
      uniform float uTime, uCheer; uniform vec3 uSunDir;
      varying vec2 vUv; varying float vSun; varying float vDist; varying float vH;
      void main() {
        vec3 base = vec3(iPos.x, 0.04, iPos.y);
        vec2 toCam = cameraPosition.xz - base.xz; float d = length(toCam); toCam /= max(d, 1e-3);
        vec3 right = vec3(toCam.y, 0.0, -toCam.x);
        vec2 face = vec2(sin(iData.w), cos(iData.w));
        float front = step(0.0, dot(face, toCam));                    // the camera is on the side the figure faces
        float ph = iData.z * 40.0;
        float hop = uCheer * step(0.35, fract(iData.z * 7.3)) * abs(sin(uTime * 7.0 + ph)) * 0.09;
        float sway = sin(uTime * 0.9 + ph) * 0.018 * position.y;
        // mirror the back view so a raised arm stays on the same side of the body
        float sx = position.x * (front > 0.5 ? 1.0 : -1.0);
        vec3 p = base + right * (sx * 0.92 * iData.y + sway) * iPos.z + vec3(0.0, (position.y * 1.84 * iData.y + hop) * iPos.z, 0.0);
        vUv = vec2((iData.x + uv.x) / 16.0, front > 0.5 ? 0.5 + uv.y * 0.5 : uv.y * 0.5);
        // a card facing the camera: lit by the sun when the sun is behind the camera, a dark shape against it otherwise
        vSun = 0.5 + 0.5 * dot(toCam, normalize(uSunDir.xz + vec2(1e-4)));
        vDist = d; vH = position.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uAmb, uSun, uFog; uniform float uFogD;
      varying vec2 vUv; varying float vSun; varying float vDist; varying float vH;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        if (t.a < 0.5) discard;
        vec3 light = uAmb * (0.72 + 0.28 * vH) + uSun * (0.12 + 0.88 * vSun * vSun) * (0.55 + 0.45 * vH);
        vec3 col = t.rgb * light;
        col = mix(col, uFog, 1.0 - exp(-uFogD * vDist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'mayday:crowd'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = true;
  let hidden = [];
  return {
    mesh, u, n,
    setCount(k) { g.instanceCount = Math.max(0, Math.min(n, k | 0)); mesh.visible = g.instanceCount > 0; },
    get count() { return g.instanceCount; },
    /** switch off the cut-outs whose place is taken by a 3D figure (indices) */
    hide(list) {
      for (const i of hidden) P[i * 3 + 2] = 1;
      for (const i of list) P[i * 3 + 2] = 0;
      hidden = list.slice(); iPos.needsUpdate = true;
    },
    get hiddenCount() { return hidden.length; },
    dispose() { g.dispose(); mat.dispose(); u.uMap.value.dispose(); },
  };
}

// ------------------------------------------------------------------------------------------------ 3D stand-ins
/** a look posed and frozen: the character's own skinned body baked to plain geometry after tweak(bones) (e.g. head back) */
export function bakePosed(look, pose = 'stand', tweak = null) {
  let ch = null;
  try {
    ch = createCharacter(look); ch.noLod = true; ch.setPose(pose); ch.blend = 1;
    for (let i = 0; i < 20; i++) ch.update(1 / 30, 0);
    if (tweak) tweak(ch.bones, ch);
    const skin = ch._skin, g = skin.geometry, group = ch.group;
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), sk = skin.skeleton, bm = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(inv, b.matrixWorld).multiply(sk.boneInverses[i]));
    const pa = g.attributes.position.array, na = g.attributes.normal.array, SI = g.attributes.skinIndex.array, SW = g.attributes.skinWeight.array, nv = pa.length / 3;
    const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3);
    for (let k = 0; k < nv; k++) {
      const x = pa[k * 3], y = pa[k * 3 + 1], z = pa[k * 3 + 2], nx = na[k * 3], ny = na[k * 3 + 1], nz = na[k * 3 + 2];
      let ox = 0, oy = 0, oz = 0, mx = 0, my = 0, mz = 0;
      for (let j = 0; j < 2; j++) {
        const w = SW[k * 4 + j]; if (!w) continue;
        const e = bm[SI[k * 4 + j]].elements;
        ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12]); oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]); oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
        mx += w * (e[0] * nx + e[4] * ny + e[8] * nz); my += w * (e[1] * nx + e[5] * ny + e[9] * nz); mz += w * (e[2] * nx + e[6] * ny + e[10] * nz);
      }
      const l = Math.hypot(mx, my, mz) || 1;
      P[k * 3] = ox; P[k * 3 + 1] = oy; P[k * 3 + 2] = oz; Nn[k * 3] = mx / l; Nn[k * 3 + 1] = my / l; Nn[k * 3 + 2] = mz / l;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(g.attributes.color.array.slice(), 3)); geo.setIndex(new THREE.BufferAttribute(g.index.array.slice(), 1));
    geo.computeBoundingSphere();
    ch.dispose();
    return geo;
  } catch (e) {
    try { ch && ch.dispose(); } catch { /* */ }
    return bakeCharacterGeometry(look, pose);          // the characters' own (untweaked) bake
  }
}
const lookUp = (amt, arm = 0) => (b) => { b.head.rotation.x -= amt; b.torso.rotation.x -= amt * 0.18; if (arm === 1) { b.armR.rotation.set(-2.55, 0, -0.25); b.foreR.rotation.set(-1.75, 0.5, 0); } else if (arm === 2) { b.armR.rotation.set(-1.5, 0, -0.1); b.foreR.rotation.set(-1.55, 0, 0); b.armL.rotation.set(-1.5, 0, 0.1); b.foreL.rotation.set(-1.55, 0, 0); } };
// variant = [kind whose look it wears, look seed, arm gesture]; VARIANT_OF[kind] = which variant stands in for that kind
const VARIANTS = [[0, 11, 0], [1, 12, 0], [4, 13, 0], [5, 14, 0], [6, 15, 0], [10, 16, 0], [11, 17, 0], [13, 18, 1], [14, 19, 0]];
const VARIANT_OF = [0, 1, 0, 1, 2, 3, 4, 4, 5, 3, 5, 6, 5, 7, 8, 2];
/**
 * spots as for createCrowd -> {group, refresh(camX, camZ, present, radius, max, skip(i)) -> indices drawn in 3D, draws, tris}
 * One InstancedMesh per variant (built lazily on the first refresh), shared character material, no shadows.
 */
export function createStandins(spots) {
  const group = new THREE.Group(); group.name = 'mayday:standins';
  let meshes = null;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const order = [], drawn = [];
  function build(cap) {
    meshes = VARIANTS.map(([kind, seed, arm], v) => {
      const geo = bakePosed(lookFor(kind, seed), 'stand', lookUp(0.42 + 0.1 * hash(v, 2), arm));
      const im = new THREE.InstancedMesh(geo, characterMaterial, cap);
      im.name = 'mayday:standin:' + KINDS[kind]; im.count = 0; im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; im.visible = false;
      im.userData.tris = geo.index.count / 3; im.userData.kindScale = KINDS[kind] === 'child' ? 1 : 1;
      group.add(im); return im;
    });
  }
  return {
    group,
    refresh(cx, cz, present, radius, max, skip, gy = 0.13) {
      drawn.length = 0;
      if (max <= 0 || present <= 0) { if (meshes) for (const m of meshes) { m.count = 0; m.visible = false; } return drawn; }
      if (!meshes) build(Math.max(8, max));
      order.length = 0;
      const r2 = radius * radius;
      for (let i = 0; i < present && i < spots.length; i++) { const s = spots[i], d = (s[0] - cx) ** 2 + (s[1] - cz) ** 2; if (d < r2 && !(skip && skip(i))) order.push(i + d * 1e-9 + 0, d, i); }
      // nearest first
      const idx = []; for (let k = 0; k < order.length; k += 3) idx.push([order[k + 1], order[k + 2]]);
      idx.sort((a, b) => a[0] - b[0]);
      for (const m of meshes) m.count = 0;
      for (let k = 0; k < idx.length && drawn.length < max; k++) {
        const i = idx[k][1], s = spots[i], m = meshes[VARIANT_OF[s[2]]];
        if (m.count >= m.instanceMatrix.count) continue;
        const sc = s[3] * (KINDS[s[2]] === 'child' ? 1 : 1) * 1.0;
        q.setFromAxisAngle(up, s[5] + (s[4] - 0.5) * 0.5); pos.set(s[0], typeof gy === 'function' ? gy(s[0], s[1]) : gy, s[1]); scl.set(sc, sc, sc);
        m.setMatrixAt(m.count++, m4.compose(pos, q, scl));
        drawn.push(i);
      }
      for (const m of meshes) { m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; }
      return drawn;
    },
    get draws() { let n = 0; if (meshes) for (const m of meshes) if (m.visible) n++; return n; },
    get tris() { let n = 0; if (meshes) for (const m of meshes) if (m.visible) n += m.count * m.userData.tris; return n; },
    dispose() { if (meshes) for (const m of meshes) { m.geometry.dispose(); m.dispose(); } },
  };
}

// ------------------------------------------------------------------------------------------------ the choir
/** red cassock, white surplice: boys in front, men behind, along the two parapets that face the street and the bridge.
 *  GUESS: where on the roof the choir stands and which way it faces; it is raised 0.75 m so that it shows over the battlements. */
export function createChoir(towerPoly, topY, rows = 2) {
  const group = new THREE.Group(); group.name = 'mayday:choir';
  const [cx, cz] = SITE.tower;
  // the four long edges of the footprint; keep the two whose outward normal looks most towards the street (south-west) and the bridge (south-east)
  const edges = [];
  for (let i = 0; i < towerPoly.length; i++) { const a = towerPoly[i], b = towerPoly[(i + 1) % towerPoly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > 5) { const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; edges.push({ a, b, L, mx, mz, south: mz - cz }); } }
  edges.sort((p, r) => r.south - p.south);
  const surplice = (seed, boy) => ({ ...randomLook(seed, { outfit: 'casual' }), figure: 'm', hairStyle: 'short', hat: null, beard: boy ? null : (seed % 3 === 0 ? 'stubble' : null), glasses: seed % 4 === 0, top: 0xf4f2ec, topStyle: 'jumper', sleeves: 'long', skirt: 'long', skirtColor: 0x9a1420, dress: false, collar: 0xffffff, bottom: 0x9a1420, shoes: 0x101010, prop: 'book', height: boy ? 1.42 : 1.78, build: boy ? 0.85 : 1 });
  const sing = (b, ch) => { b.head.rotation.x -= 0.08; try { ch._jaw.rotation.x = 0.32; ch._jaw.position.y = ch._jawY - 0.012; } catch { /* */ } };
  const defs = [[surplice(31, true), []], [surplice(32, false), []], [surplice(35, false), []]];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let k = 0;
  for (const e of edges.slice(0, 2)) {
    const dx = (e.b[0] - e.a[0]) / e.L, dz = (e.b[1] - e.a[1]) / e.L; let nx = dz, nz = -dx; if ((e.mx - cx) * nx + (e.mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
    const h = Math.atan2(nx, nz);
    for (let row = 0; row < rows; row++) for (let j = 0; j < 6; j++, k++) {
      const u = (j - 2.5) * 0.8 + row * 0.3, back = 1.05 + row * 0.8;
      const sc = 0.94 + hash(k, 4) * 0.12;
      q.setFromAxisAngle(up, h + (hash(k, 5) - 0.5) * 0.3); pos.set(e.mx + dx * u - nx * back, topY + 0.75 + row * 0.22, e.mz + dz * u - nz * back); scl.set(sc, sc, sc);
      defs[row === 0 ? 0 : 1 + (k % 2)][1].push(m4.compose(pos, q, scl).clone());
    }
  }
  let tris = 0;
  for (const [look, mats] of defs) {
    const geo = bakePosed(look, 'stand', sing), im = new THREE.InstancedMesh(geo, characterMaterial, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m)); im.count = mats.length; im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; im.name = 'mayday:choir';
    tris += (geo.index.count / 3) * mats.length; group.add(im);
  }
  // the staging they stand on (hidden behind the parapet), so nobody floats when seen from a roof
  return { group, tris, n: k, dispose() { group.traverse((o) => { if (o.isInstancedMesh) { o.geometry.dispose(); o.dispose(); } }); } };
}

// ------------------------------------------------------------------------------------------------ barriers
function dressAtlas() {
  // left half: one galvanised crowd barrier (2.3 x 1.1 m) on its feet; right half: the same carrying a ROAD CLOSED board
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  for (let k = 0; k < 2; k++) {
    g.save(); g.translate(k * 256, 0);
    g.strokeStyle = '#b9bec4'; g.lineWidth = 5; g.strokeRect(6, 8, 244, 96);
    g.lineWidth = 3; for (let i = 1; i < 14; i++) { g.beginPath(); g.moveTo(6 + i * (244 / 14), 8); g.lineTo(6 + i * (244 / 14), 104); g.stroke(); }
    g.strokeStyle = '#8f959c'; g.lineWidth = 2; g.strokeRect(8.5, 10.5, 239, 91);
    g.fillStyle = '#9aa0a6'; g.fillRect(22, 104, 6, 20); g.fillRect(228, 104, 6, 20); g.fillRect(10, 121, 30, 6); g.fillRect(216, 121, 30, 6);
    if (k === 1) {
      g.fillStyle = '#c8201c'; g.fillRect(40, 18, 176, 70); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(45, 23, 166, 60);
      g.fillStyle = '#ffffff'; g.font = 'bold 30px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ROAD', 128, 40); g.fillText('CLOSED', 128, 68);
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** plan: [[x, z, heading (along the panel), kind]] -> {mesh, tris}; gy(x, z) = ground height */
export function createDressing(plan, gy = () => 0.04) {
  const pos = [], uv = [], nor = [], idx = [];
  plan.forEach(([x, z, h, kind], i) => {
    const dx = Math.sin(h) * 1.15, dz = Math.cos(h) * 1.15, y0 = gy(x, z), y1 = y0 + 1.22, u0 = kind ? 0.5 : 0, nx = Math.cos(h), nz = -Math.sin(h);
    pos.push(x - dx, y0, z - dz, x + dx, y0, z + dz, x + dx, y1, z + dz, x - dx, y1, z - dz);
    uv.push(u0, 0, u0 + 0.5, 0, u0 + 0.5, 1, u0, 1); nor.push(nx, 0.35, nz, nx, 0.35, nz, nx, 0.35, nz, nx, 0.35, nz);
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ map: dressAtlas(), alphaTest: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'mayday:barriers'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  return { mesh, tris: plan.length * 2, dispose() { g.dispose(); mat.map.dispose(); mat.dispose(); } };
}
