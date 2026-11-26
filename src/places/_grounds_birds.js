// Worcester College lake wildlife: mallards (drakes, ducks, ducklings), mute swans, Canada geese, moorhens.
// Six InstancedMeshes (one per kind) sharing ONE vertex-coloured material whose vertex shader poses the head/neck
// (yaw, pitch) and wings (sweep, flap) from a per-instance attribute — so ducks dabble, preen, sleep with the head
// tucked, geese graze, swans raise their wings, everything flaps on take-off. Plus one InstancedMesh of wakes and one
// of floating bread. update() is allocation-free (WebAudio calls are rate-limited).
import * as THREE from 'three';
const NI = (g) => (g.index ? g.toNonIndexed() : g);
import { pip, dRing } from './_grounds_util.js';

const WATER_Y = 0.036;
// ------------------------------------------------------------------------------------------------ geometry
function ellipsoid(rx, ry, rz, seg = 10) { const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 3)); g.scale(rx, ry, rz); return NI(g); }
function partGeom(list) {
  // list: [{g (non-indexed), part, pivot:[x,y,z], col:(x,y,z)=>hex}] -> merged geometry with color/aPart/aPivot
  let n = 0; for (const p of list) n += p.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), part = new Float32Array(n), piv = new Float32Array(n * 3);
  const c = new THREE.Color(); let o = 0;
  for (const p of list) {
    const P = p.g.attributes.position, N = p.g.attributes.normal;
    for (let i = 0; i < P.count; i++, o++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      nor[o * 3] = N.getX(i); nor[o * 3 + 1] = N.getY(i); nor[o * 3 + 2] = N.getZ(i);
      c.set(typeof p.col === 'function' ? p.col(x, y, z) : p.col);
      col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
      part[o] = p.part; piv[o * 3] = p.pivot[0]; piv[o * 3 + 1] = p.pivot[1]; piv[o * 3 + 2] = p.pivot[2];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  g.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3));
  g.computeBoundingSphere();
  return g;
}
const tr = (g, x, y, z) => { g.translate(x, y, z); return g; };
function segment(a, b, r0, r1, seg = 7) {
  // tapered cylinder between points a and b
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, false);
  g.translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z);
  return NI(g);
}
function wingGeom(span, chord, thick, side) {
  // extended wing along +x (side=1) or -x, leading edge at z=+chord*0.3, tapering to a point
  const s = new THREE.Shape(); s.moveTo(0, chord * 0.35); s.lineTo(span * 0.55, chord * 0.3); s.lineTo(span, -chord * 0.15); s.lineTo(span * 0.6, -chord * 0.55); s.lineTo(0, -chord * 0.65); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }); // in xy-plane, depth z
  g.rotateX(-Math.PI / 2); g.translate(0, thick / 2, 0); if (side < 0) g.scale(-1, 1, 1);
  return NI(g);
}
/**
 * Generic waterfowl. d: dims; colours. Local frame: +z forward, waterline y=0, legs below.
 */
function buildBird(d) {
  const parts = [];
  const pivotNeck = [0, d.neck[0][1], d.neck[0][2]];
  parts.push({ g: tr(ellipsoid(d.body[0], d.body[1], d.body[2], 9), 0, d.body[3], 0), part: 0, pivot: [0, 0, 0], col: d.bodyCol });
  // tail
  const tail = new THREE.ConeGeometry(d.tail[1], d.tail[0], 6); tail.rotateX(-Math.PI / 2 - (d.tail[3] || 0.35)); tail.translate(0, d.body[3] + d.tail[2], -d.body[2] * 0.95);
  parts.push({ g: NI(tail), part: 0, pivot: [0, 0, 0], col: d.tailCol });
  // legs (below the waterline; hidden when swimming)
  for (const s of [-1, 1]) {
    parts.push({ g: segment([s * d.body[0] * 0.35, d.body[3] - d.body[1] * 0.5, -d.body[2] * 0.15], [s * d.body[0] * 0.38, -d.legH, -d.body[2] * 0.1], d.legR, d.legR * 0.8, 4), part: 0, pivot: [0, 0, 0], col: d.legCol });
    const foot = new THREE.BoxGeometry(d.legR * 5, d.legR * 0.6, d.legR * 6); foot.translate(s * d.body[0] * 0.38, -d.legH, -d.body[2] * 0.1 + d.legR * 2.5);
    parts.push({ g: NI(foot), part: 0, pivot: [0, 0, 0], col: d.legCol });
  }
  // neck (polyline) + head + bill: part 1, pivot at the neck base
  const N = d.neck;
  for (let i = 0; i < N.length - 1; i++) parts.push({ g: segment([0, N[i][1], N[i][2]], [0, N[i + 1][1], N[i + 1][2]], N[i][0], N[i + 1][0], 5), part: 1, pivot: pivotNeck, col: d.neckCol });
  const hd = d.head; // [y, z, r, zscale]
  const head = ellipsoid(hd[2], hd[2] * 0.95, hd[2] * hd[3], 7); head.translate(0, hd[0], hd[1]);
  parts.push({ g: head, part: 1, pivot: pivotNeck, col: d.headCol });
  const bl = d.bill; // [len, w, h, droop]
  const bill = new THREE.BoxGeometry(bl[1], bl[2], bl[0]); bill.translate(0, hd[0] - hd[2] * 0.15 - (bl[3] || 0), hd[1] + hd[2] * hd[3] * 0.8 + bl[0] / 2);
  parts.push({ g: NI(bill), part: 1, pivot: pivotNeck, col: d.billCol });
  if (d.knob) { const k = ellipsoid(bl[1] * 0.45, bl[2] * 0.9, bl[1] * 0.45, 6); k.translate(0, hd[0] + bl[2] * 0.2, hd[1] + hd[2] * hd[3] * 0.85); parts.push({ g: k, part: 1, pivot: pivotNeck, col: 0x111111 }); }
  // wings (part 2 left/+x, 3 right/-x), pivot at the shoulders
  const w = d.wing; // [span, chord, thick, shoulderY, shoulderZ]
  for (const s of [1, -1]) {
    const g = wingGeom(w[0], w[1], w[2], s); const sx = s * d.body[0] * 0.75;
    g.translate(sx, w[3], w[4]);
    parts.push({ g, part: s > 0 ? 2 : 3, pivot: [sx, w[3], w[4]], col: d.wingCol });
  }
  return partGeom(parts);
}

const SPECIES = {
  drake: { scale: 1, body: [0.115, 0.085, 0.235, 0.045], tail: [0.08, 0.04, 0.04, 0.5], legH: 0.1, legR: 0.009,
    neck: [[0.034, 0.08, 0.15], [0.03, 0.19, 0.2]], head: [0.215, 0.21, 0.052, 1.25], bill: [0.06, 0.042, 0.016, 0.0], wing: [0.3, 0.15, 0.012, 0.105, 0.05],
    bodyCol: (x, y, z) => (z > 0.1 && y < 0.11 ? 0x5e3220 : z < -0.17 ? 0x222222 : y > 0.1 ? 0x8a8478 : 0xc2beb4), tailCol: 0xe8e8e0,
    neckCol: (x, y) => (y < 0.115 ? 0xeeeeee : 0x0f5a32), headCol: 0x0d5530, billCol: 0xd8c43a, legCol: 0xe08a2a, wingCol: (x, y, z) => (Math.abs(x) > 0.2 && z < 0 ? 0x2a3a9a : 0x6e675c) },
  hen: { scale: 0.95, body: [0.11, 0.08, 0.22, 0.045], tail: [0.07, 0.035, 0.04, 0.45], legH: 0.1, legR: 0.009,
    neck: [[0.033, 0.08, 0.14], [0.03, 0.18, 0.19]], head: [0.205, 0.2, 0.05, 1.25], bill: [0.055, 0.04, 0.015, 0], wing: [0.28, 0.14, 0.012, 0.1, 0.05],
    bodyCol: (x, y, z) => ((Math.sin(x * 90) + Math.sin(z * 70 + y * 50)) > 0.6 ? 0x5e4228 : 0x8a6a44), tailCol: 0x9a7a52,
    neckCol: 0x8a6a46, headCol: (x, y) => (y > 0.21 ? 0x4a3420 : 0x9a7a52), billCol: 0xb87a2a, legCol: 0xd88a2a, wingCol: (x, y, z) => (Math.abs(x) > 0.2 && z < 0 ? 0x2a3a9a : 0x6a4e30) },
  duckling: { scale: 1, body: [0.045, 0.04, 0.07, 0.03], tail: [0.02, 0.015, 0.02, 0.3], legH: 0.05, legR: 0.006,
    neck: [[0.022, 0.04, 0.05], [0.02, 0.07, 0.07]], head: [0.08, 0.075, 0.032, 1.1], bill: [0.022, 0.02, 0.008, 0], wing: [0.05, 0.04, 0.008, 0.05, 0.0],
    bodyCol: (x, y) => (y > 0.05 ? 0x4a3a1e : 0xd8c070), tailCol: 0x4a3a1e, neckCol: 0xd8c070, headCol: (x, y) => (y > 0.09 ? 0x4a3a1e : 0xe2cc78), billCol: 0x3a3020, legCol: 0x6a5a30, wingCol: 0x4a3a1e },
  swan: { scale: 1, body: [0.26, 0.17, 0.55, 0.09], tail: [0.18, 0.09, 0.08, 0.7], legH: 0.2, legR: 0.02,
    neck: [[0.07, 0.16, 0.38], [0.055, 0.42, 0.44], [0.048, 0.62, 0.42], [0.045, 0.74, 0.47]], head: [0.76, 0.53, 0.065, 1.4], bill: [0.1, 0.06, 0.03, 0.02], knob: true, wing: [0.95, 0.42, 0.03, 0.22, 0.12],
    bodyCol: 0xf1f0ea, tailCol: 0xecebe4, neckCol: 0xf1f0ea, headCol: (x, y, z) => (z > 0.59 && y < 0.78 ? 0x222222 : 0xf1f0ea), billCol: 0xe0701e, legCol: 0x222222, wingCol: 0xeceae2 },
  goose: { scale: 1, body: [0.17, 0.12, 0.34, 0.07], tail: [0.1, 0.06, 0.06, 0.5], legH: 0.16, legR: 0.014,
    neck: [[0.045, 0.12, 0.27], [0.035, 0.38, 0.33], [0.032, 0.5, 0.35]], head: [0.53, 0.38, 0.045, 1.5], bill: [0.055, 0.035, 0.018, 0.01], wing: [0.6, 0.3, 0.02, 0.16, 0.08],
    bodyCol: (x, y, z) => (z > 0.18 ? 0xc8bca6 : y < 0.02 ? 0xd8d0c0 : z < -0.26 ? 0xeeeeee : 0x7b6a58), tailCol: 0x151515,
    neckCol: 0x151515, headCol: (x, y, z) => (Math.abs(x) > 0.015 && y < 0.54 && z < 0.42 ? 0xf2f2f2 : 0x151515), billCol: 0x151515, legCol: 0x222222, wingCol: 0x6a5a48 },
  moorhen: { scale: 1, body: [0.065, 0.065, 0.13, 0.06], tail: [0.05, 0.03, 0.08, 0.9], legH: 0.11, legR: 0.007,
    neck: [[0.03, 0.09, 0.08], [0.026, 0.14, 0.11]], head: [0.15, 0.125, 0.035, 1.15], bill: [0.035, 0.018, 0.016, 0.005], wing: [0.15, 0.08, 0.008, 0.09, 0.0],
    bodyCol: (x, y, z) => (Math.abs(x) > 0.055 && y > 0.06 && y < 0.08 ? 0xf0f0f0 : 0x2a2c34), tailCol: (x, y) => (y < 0.12 ? 0xf2f2f2 : 0x222228),
    neckCol: 0x2a2c34, headCol: 0x26282e, billCol: (x, y, z) => (z > 0.205 ? 0xe8d040 : 0xc8201a), legCol: 0x9ab83a, wingCol: 0x4a3e30 },
};
const KIND_ORDER = ['drake', 'hen', 'duckling', 'swan', 'goose', 'moorhen'];
// behaviour parameters per kind
const KP = {
  drake: { swim: 0.55, walk: 0.5, fly: 9, flap: 15, turn: 3, sep: 0.5, call: 'drake' },
  hen: { swim: 0.55, walk: 0.5, fly: 9, flap: 15, turn: 3, sep: 0.5, call: 'quack' },
  duckling: { swim: 0.7, walk: 0.45, fly: 0, flap: 0, turn: 5, sep: 0.18, call: 'peep' },
  swan: { swim: 0.45, walk: 0.5, fly: 0, flap: 5, turn: 1.2, sep: 1.6, call: 'swan' },
  goose: { swim: 0.6, walk: 0.55, fly: 10, flap: 9, turn: 2, sep: 0.9, call: 'honk' },
  moorhen: { swim: 0.45, walk: 0.6, fly: 0, flap: 18, turn: 4, sep: 0.4, call: 'moorhen' },
};

function birdMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPart;\nattribute vec3 aPivot;\nattribute vec4 aPose;\n')
      .replace('#include <begin_vertex>', `vec3 transformed = vec3( position );
        if ( aPart > 0.5 ) {
          vec3 p = transformed - aPivot;
          if ( aPart < 1.5 ) {
            float cp = cos( aPose.y ), sp = sin( aPose.y );
            p = vec3( p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp );
            float cy = cos( aPose.x ), sy = sin( aPose.x );
            p = vec3( p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy );
          } else {
            float side = aPart > 2.5 ? -1.0 : 1.0;
            p.z *= mix( 0.3, 1.0, aPose.w ); p.x *= mix( 0.6, 1.0, aPose.w );   // folded wing: chord squeezed so it lies along the body side
            float sw = side * ( 1.0 - aPose.w ) * 1.45;
            float c1 = cos( sw ), s1 = sin( sw );
            p = vec3( p.x * c1 + p.z * s1, p.y, -p.x * s1 + p.z * c1 );
            float fa = aPose.z * side; float c2 = cos( fa ), s2 = sin( fa );
            p = vec3( p.x * c2 - p.y * s2, p.x * s2 + p.y * c2, p.z );
          }
          transformed = p + aPivot;
        }`);
  };
  m.customProgramCacheKey = () => 'gto-bird';
  return m;
}

function wakeTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.55 - i * 0.15})`; g.lineWidth = 5 - i;
    const y0 = 18 + i * 34;
    g.beginPath(); g.moveTo(64 - 8 - i * 14, y0 + 20); g.quadraticCurveTo(64, y0 - 14, 64 + 8 + i * 14, y0 + 20); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------------------------------------ sounds
function makeSounds(game) {
  let next = 0;
  const A = () => game.audio && game.audio.ctx;
  function voice(t, f0, f1, dur, gain, type, bp, q, bp2) {
    const ctx = A(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain(), mix = ctx.createGain();
    o.type = type; o2.type = 'square';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o2.frequency.setValueAtTime(f0 * 1.005, t); o2.frequency.exponentialRampToValueAtTime(f1 * 1.005, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = q;
    f2.type = 'bandpass'; f2.frequency.value = bp2; f2.Q.value = q * 1.4;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.setValueAtTime(gain, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(g2); g2.connect(f); o.connect(f2); f.connect(mix); f2.connect(mix); mix.connect(g); g.connect(game.audio.master);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function noise(t, dur, gain, freq, type = 'highpass', q = 0.7) {
    const ctx = A(), n = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(game.audio.master); s.start(t);
  }
  return {
    /** kind: quack|drake|honk|swan|hiss|moorhen|peep|splash|flap ; dist in metres. Returns false if rate-limited. */
    play(kind, dist, force) {
      const ctx = A(); if (!ctx) return false;
      const now = ctx.currentTime;
      if (!force && now < next) return false;
      const att = Math.max(0, 1 - dist / 70); if (att <= 0.01) return false;
      const vol = att * att;
      next = now + 0.3;
      const p = 0.92 + Math.random() * 0.16;
      if (kind === 'quack') {        // hen: the classic descending "QUACK quack quack quack"
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) voice(now + i * 0.24, 300 * p * (1 - i * 0.04), 215 * p * (1 - i * 0.05), 0.2 - i * 0.012, 0.5 * vol * (1 - i * 0.16), 'sawtooth', 1150, 3.5, 2500);
        next = now + n * 0.24 + 0.2;
      } else if (kind === 'drake') {  // quieter, raspier "rhaeb"
        voice(now, 210 * p, 165 * p, 0.17, 0.3 * vol, 'sawtooth', 900, 2.5, 2100); noise(now, 0.15, 0.04 * vol, 1500, 'bandpass', 2);
      } else if (kind === 'honk') {   // Canada goose "ha-ronk"
        voice(now, 330 * p, 420 * p, 0.09, 0.35 * vol, 'sawtooth', 850, 2.5, 1900);
        voice(now + 0.1, 520 * p, 380 * p, 0.2, 0.45 * vol, 'sawtooth', 1000, 3, 2300);
        next = now + 0.5;
      } else if (kind === 'hiss') {
        noise(now, 0.9, 0.4 * vol, 2600, 'highpass', 0.8); next = now + 1;
      } else if (kind === 'swan') {  // mute swans are mostly quiet: soft snort
        voice(now, 170 * p, 140 * p, 0.14, 0.18 * vol, 'sawtooth', 700, 2, 1500);
      } else if (kind === 'moorhen') { // sharp "kurruk"
        voice(now, 900 * p, 700 * p, 0.06, 0.3 * vol, 'square', 1500, 4, 3000); voice(now + 0.08, 1000 * p, 800 * p, 0.07, 0.3 * vol, 'square', 1500, 4, 3000);
      } else if (kind === 'peep') {
        voice(now, 3200 * p, 2800 * p, 0.07, 0.12 * vol, 'sine', 3000, 2, 5000); voice(now + 0.12, 3300 * p, 2900 * p, 0.07, 0.1 * vol, 'sine', 3000, 2, 5000);
      } else if (kind === 'splash') {
        noise(now, 0.35, 0.3 * vol, 900, 'lowpass', 0.8); next = now + 0.1;
      } else if (kind === 'flap') {
        for (let i = 0; i < 5; i++) noise(now + i * 0.08, 0.07, 0.25 * vol * (1 - i * 0.15), 500, 'bandpass', 1);
        next = now + 0.2;
      }
      return true;
    },
  };
}

// ------------------------------------------------------------------------------------------------ the flock
/**
 * createBirds(game, {lakeOuter, lakeHole, feedSpots:[{x,z,h}], exclude(x,z)->bool, buildings:[poly]})
 * -> {update(dt), feed(spotIndex), groups, stats}
 */
export function createBirds(game, opt) {
  const scene = game.worldScene, col = game.worldCollider;
  const outer = opt.lakeOuter, hole = opt.lakeHole;
  // ---- occupancy grid (1 m): 0 = nothing, 1 = bank, 2 = water, 3 = island
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  minX -= 7; minZ -= 7; maxX += 7; maxZ += 7;
  const GW = Math.ceil(maxX - minX), GH = Math.ceil(maxZ - minZ), grid = new Uint8Array(GW * GH);
  const waterCells = [], bankCells = [], islandCells = [];
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = minX + i + 0.5, z = minZ + j + 0.5;
    if (opt.exclude(x, z)) continue;
    const inOuter = pip(x, z, outer), inHole = pip(x, z, hole);
    const dO = dRing(x, z, outer), dH = dRing(x, z, hole);
    if (inOuter && !inHole) {
      if (col.isWater(x, z) && !col.onBridge(x, z)) { if (dO > 0.7 && dH > 0.7) { grid[j * GW + i] = 2; waterCells.push(i, j); } else grid[j * GW + i] = 4; }
    } else if (inHole) {
      if (dH > 0.6) { grid[j * GW + i] = 3; islandCells.push(i, j); }
    } else if (Math.min(dO, dH) < 5 && !col.isWater(x, z)) {
      let inB = false; for (const b of opt.buildings) if (pip(x, z, b)) { inB = true; break; }
      if (!inB && col.isFree(x, z, 0.4)) { grid[j * GW + i] = 1; bankCells.push(i, j); }
    }
  }
  const cellAt = (x, z) => { const i = Math.floor(x - minX), j = Math.floor(z - minZ); return i < 0 || j < 0 || i >= GW || j >= GH ? 0 : grid[j * GW + i]; };
  const pick = (arr, r) => { const k = Math.floor(r * (arr.length / 2)) * 2; return k; };

  // ---- meshes
  const mat = birdMaterial();
  const kinds = {};
  const counts = { drake: 7, hen: 7, duckling: 6, swan: 2, goose: 5, moorhen: 2 };
  const group = new THREE.Group(); group.name = 'worcester-birds'; scene.add(group);
  for (const k of KIND_ORDER) {
    const geo = buildBird(SPECIES[k]);
    const n = counts[k], pose = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); pose.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPose', pose);
    const im = new THREE.InstancedMesh(geo, mat, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false; im.receiveShadow = true; im.name = 'birds:' + k;
    group.add(im);
    kinds[k] = { im, pose, n, tris: geo.attributes.position.count / 3 };
  }
  // wakes
  const wakeGeo = new THREE.PlaneGeometry(1, 1); wakeGeo.rotateX(-Math.PI / 2); wakeGeo.translate(0, 0, -0.5);
  const wakeMat = new THREE.MeshBasicMaterial({ map: wakeTexture(), transparent: true, depthWrite: false, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -20 });
  const NB = Object.values(counts).reduce((a, b) => a + b, 0);
  const wakes = new THREE.InstancedMesh(wakeGeo, wakeMat, NB); wakes.frustumCulled = false; wakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); wakes.renderOrder = 2;
  group.add(wakes);
  // bread
  const NC = 24;
  const crumbGeo = new THREE.BoxGeometry(0.05, 0.02, 0.04);
  const crumbs = new THREE.InstancedMesh(crumbGeo, new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 1 }), NC); crumbs.frustumCulled = false; crumbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(crumbs);
  const cr = { x: new Float32Array(NC), z: new Float32Array(NC), y: new Float32Array(NC), vx: new Float32Array(NC), vz: new Float32Array(NC), vy: new Float32Array(NC), t: new Float32Array(NC), on: new Uint8Array(NC), claimed: new Int16Array(NC) };

  // ---- bird records
  const rng = (() => { let a = 12345; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const birds = [];
  let mother = null;
  for (const k of KIND_ORDER) for (let i = 0; i < counts[k]; i++) {
    const kw = pick(waterCells, rng());
    const b = { kind: k, kp: KP[k], idx: i, x: minX + waterCells[kw] + 0.5, z: minZ + waterCells[kw + 1] + 0.5, y: WATER_Y, h: rng() * 6.28, v: 0,
      state: 'swim', t: rng() * 5, tx: 0, tz: 0, mode: 0, hy: 0, hp: 0, thy: 0, thp: 0, flap: 0, spread: 0, tspread: 0, pitch: 0, tpitch: 0, roll: 0, alt: 0,
      callT: 3 + rng() * 15, phase: rng() * 6.28, leader: null, follow: 0, roostI: -1, sx: 0, sz: 0, scale: SPECIES[k].scale * (0.95 + rng() * 0.1), crumb: -1, visible: true, hissT: 0, speed: 0, fx: 0, fz: 0 };
    b.tx = b.x; b.tz = b.z;
    // roost: geese and swans on the island (they nest there), the rest on the bank
    const roostList = (k === 'goose' || k === 'swan') && islandCells.length ? islandCells : bankCells;
    if (roostList.length) { const r = pick(roostList, rng()); b.rx = minX + roostList[r] + 0.5; b.rz = minZ + roostList[r + 1] + 0.5; } else { b.rx = b.x; b.rz = b.z; }
    birds.push(b);
    if (k === 'hen' && i === 0) mother = b;
  }
  // ducklings follow the first hen in a line
  let prev = mother;
  for (const b of birds) if (b.kind === 'duckling') { b.leader = prev; b.x = mother.x; b.z = mother.z; prev = b; }
  if (mother) mother.isMother = true;

  const sounds = makeSounds(game);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _hide = new THREE.Matrix4().makeScale(0, 0, 0);
  const allowWater = (c) => c === 2, allowLand = (c) => c === 1 || c === 3, allowAny = (c) => c >= 1;

  function newWaterTarget(b, near) {
    for (let k = 0; k < 8; k++) {
      let x, z;
      if (near) { x = b.x + (rng() - 0.5) * near * 2; z = b.z + (rng() - 0.5) * near * 2; }
      else { const w = pick(waterCells, rng()); x = minX + waterCells[w] + 0.5; z = minZ + waterCells[w + 1] + 0.5; }
      if (cellAt(x, z) === 2) { b.tx = x; b.tz = z; return true; }
    }
    b.tx = b.x; b.tz = b.z; return false;
  }
  function newBankTarget(b, radius) {
    for (let k = 0; k < 14; k++) {
      const x = b.x + (rng() - 0.5) * radius * 2, z = b.z + (rng() - 0.5) * radius * 2, c = cellAt(x, z);
      if (c === 1 || c === 3) { b.tx = x; b.tz = z; return true; }
    }
    return false;
  }
  function steer(b, speed, dt, allow) {
    const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
    if (d < 0.12) { b.speed = 0; return 1; }
    const want = Math.atan2(dx, dz); let dh = want - b.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const maxT = b.kp.turn * dt; b.h += Math.max(-maxT, Math.min(maxT, dh));
    const sp = speed * (Math.abs(dh) > 1.2 ? 0.3 : 1), st = Math.min(d, sp * dt);
    const nx = b.x + Math.sin(b.h) * st, nz = b.z + Math.cos(b.h) * st;
    if (!allow(cellAt(nx, nz))) { b.speed = 0; return -1; }
    b.x = nx; b.z = nz; b.speed = sp;
    return 0;
  }
  function setState(b, s, t) { b.state = s; b.t = t; }

  // ---- bread
  let crumbI = 0, breadActive = 0;
  function throwBread(sx, sz, h) {
    for (let k = 0; k < 10; k++) {
      const i = crumbI++ % NC, a = h + (rng() - 0.5) * 0.9, sp = 3 + rng() * 4;
      cr.x[i] = sx + Math.sin(h) * 0.4; cr.z[i] = sz + Math.cos(h) * 0.4; cr.y[i] = 1.3;
      cr.vx[i] = Math.sin(a) * sp; cr.vz[i] = Math.cos(a) * sp; cr.vy[i] = 2 + rng() * 2; cr.t[i] = 45; cr.on[i] = 1; cr.claimed[i] = -1;
    }
    breadActive = 40;
    // everybody within 45 m comes over
    for (const b of birds) {
      if (b.state === 'sleep' || b.state === 'fly' || b.state === 'flee') continue;
      const d = Math.hypot(b.x - sx, b.z - sz);
      if (d < 45 && b.kind !== 'duckling') { setState(b, 'feed', 25); b.crumb = -1; }
    }
  }
  function nearestCrumb(b) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < NC; i++) {
      if (!cr.on[i] || cr.y[i] > 0.2) continue;
      const d = Math.hypot(cr.x[i] - b.x, cr.z[i] - b.z) + (cr.claimed[i] >= 0 ? 4 : 0);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---- main update
  const P = game.player.pos;
  let acc = 0, clock = 0, hissCool = 0;
  const api = {
    group, kinds, wakes, crumbs, grid: { waterCells: waterCells.length / 2, bankCells: bankCells.length / 2, islandCells: islandCells.length / 2 },
    birds,
    cellAt,
    feed(x, z, h) { throwBread(x, z, h); },
    get breadActive() { return breadActive > 0; },
    update(dt, playerNear) {
      if (!(dt > 0)) return;   // the first frame's dt can be negative
      // graphics pass 2: birds are a few pixels beyond ~130 m from the lake: don't draw them (simulation unchanged)
      { const c = game.camera ? game.camera.position : P, ex = Math.max(minX - c.x, 0, c.x - maxX), ez = Math.max(minZ - c.z, 0, c.z - maxZ); group.visible = ex * ex + ez * ez < 130 * 130; }
      acc += dt; clock += dt;
      const dPlayer = Math.hypot(P.x - (minX + maxX) / 2, P.z - (minZ + maxZ) / 2);
      const step = dPlayer > 110 ? 0.25 : 0;   // reduced rate when far away
      if (acc < step) return;
      const DT = Math.min(0.25, acc); acc = 0;
      const hour = game.time.hour, night = hour < 5.5 || hour > 21.3, ducklingsOut = hour > 8 && hour < 19;
      const running = !game.player.vehicle && game.player.speed > 4.2 && game.player.place === 'world';
      const pv = game.player.vehicle;
      hissCool -= DT;
      if (breadActive > 0) breadActive -= DT;
      // crumbs
      for (let i = 0; i < NC; i++) {
        if (!cr.on[i]) continue;
        if (cr.y[i] > WATER_Y + 0.01) {
          cr.vy[i] -= 9.8 * DT; cr.x[i] += cr.vx[i] * DT; cr.z[i] += cr.vz[i] * DT; cr.y[i] += cr.vy[i] * DT;
          const gc = cellAt(cr.x[i], cr.z[i]), ground = gc === 2 || gc === 4 ? WATER_Y + 0.005 : 0.01;
          if (cr.y[i] <= ground) { cr.y[i] = ground; cr.vx[i] = cr.vz[i] = cr.vy[i] = 0; }
        } else if (cellAt(cr.x[i], cr.z[i]) === 2) { cr.x[i] += Math.sin(clock * 0.3 + i) * 0.02 * DT; }
        if ((cr.t[i] -= DT) <= 0) cr.on[i] = 0;
      }
      // birds
      for (const b of birds) {
        const kp = b.kp, here0 = cellAt(b.x, b.z), here = here0 === 4 ? 2 : here0;
        const dpx = b.x - P.x, dpz = b.z - P.z, dp = Math.hypot(dpx, dpz);
        b.t -= DT; b.callT -= DT;
        if (b.hissT > 0) b.hissT -= DT;
        // hidden ducklings outside their hours
        if (b.kind === 'duckling') { b.visible = ducklingsOut; if (!b.visible) continue; }
        // --- threats
        const threat = (running && dp < 8) || (pv && dp < 10 && (pv.speed || 0) > 2);
        if (threat && b.state !== 'fly' && b.state !== 'flee' && b.state !== 'chase') {
          if (b.kind === 'swan' && !pv) { setState(b, 'chase', 3.5); b.sx = b.x; b.sz = b.z; if (hissCool <= 0) { sounds.play('hiss', dp, true); hissCool = 3; } }
          else if (kp.fly > 0 && !(b.isMother && ducklingsOut)) {
            setState(b, 'fly', 0); b.alt = Math.max(b.alt, 0.05);
            // land somewhere on the water away from the player
            for (let k = 0; k < 10; k++) { newWaterTarget(b); if (Math.hypot(b.tx - P.x, b.tz - P.z) > 30) break; }
            sounds.play('flap', dp); if (rng() < 0.6) sounds.play(b.kind === 'goose' ? 'honk' : 'quack', dp, true);
          } else {
            setState(b, 'flee', 2.5 + rng());
            b.tx = b.x + (dpx / (dp || 1)) * 8; b.tz = b.z + (dpz / (dp || 1)) * 8;
            if (b.kind === 'moorhen') sounds.play('moorhen', dp);
          }
        }
        // swans defend their patch against anyone who walks up close
        if (b.kind === 'swan' && b.state !== 'chase' && b.state !== 'sleep' && dp < 3.2 && !pv && game.player.place === 'world' && b.hissT <= 0) {
          setState(b, 'chase', 3); b.sx = b.x; b.sz = b.z; b.hissT = 9;
          if (hissCool <= 0) { sounds.play('hiss', dp, true); hissCool = 3; }
        }
        // night roost
        if (night && b.state !== 'fly' && b.state !== 'chase' && b.state !== 'sleep' && b.state !== 'roost' && b.kind !== 'duckling') { setState(b, 'roost', 60); if (Math.hypot(b.rx - b.x, b.rz - b.z) < 45) { b.tx = b.rx; b.tz = b.rz; } else if (!newBankTarget(b, 22)) setState(b, 'sleep', 80); }
        if (!night && (b.state === 'sleep' || b.state === 'roost') && b.t < 50) setState(b, 'swim', 0);

        let thy = Math.sin(clock * 0.5 + b.phase) * 0.35, thp = 0, tpitch = 0, tspread = 0, flapA = 0;
        switch (b.state) {
          case 'swim': case 'walk': {
            const onLand = here === 1 || here === 3;
            const r = steer(b, onLand ? kp.walk : kp.swim * (0.6 + 0.4 * Math.sin(b.phase + clock * 0.2)), DT, allowAny);
            if (r !== 0 || b.t <= 0) {
              const roll = rng();
              if (onLand) {
                if (roll < 0.35) newWaterTarget(b, 10);
                else if (b.kind === 'goose' && roll < 0.8) setState(b, 'graze', 4 + rng() * 8);
                else if (roll < 0.9) setState(b, 'preen', 3 + rng() * 5);
                else if (!newBankTarget(b, 5)) newWaterTarget(b, 10);
              } else if (roll < 0.25 && b.kind !== 'swan' && b.kind !== 'duckling') setState(b, 'dabble', 2 + rng() * 4);
              else if (roll < 0.35) setState(b, 'preen', 3 + rng() * 5);
              else if (roll < (b.kind === 'goose' ? 0.65 : 0.45) && newBankTarget(b, 9)) { /* go ashore */ }
              else newWaterTarget(b, 14);
              if (b.state === 'swim' || b.state === 'walk') b.t = 4 + rng() * 10;
            }
            if (b.leader && b.leader.visible !== false) setState(b, 'follow', 1);
            break;
          }
          case 'follow': {
            const L = b.leader, gap = 0.32;
            const fx = L.x - Math.sin(L.h) * gap, fz = L.z - Math.cos(L.h) * gap;
            b.tx = fx; b.tz = fz;
            const d = Math.hypot(fx - b.x, fz - b.z);
            steer(b, Math.min(1.6, kp.swim * (0.4 + d * 2)), DT, allowAny);
            if (L.state === 'fly' && d > 6) { b.tx = L.tx; b.tz = L.tz; }
            break;
          }
          case 'dabble':
            tpitch = 1.85; thp = 0.3; thy = 0;
            if (b.t <= 0) setState(b, 'swim', 3 + rng() * 6);
            break;
          case 'preen':
            thy = (b.idx % 2 ? 1 : -1) * (2.2 + Math.sin(clock * 3 + b.phase) * 0.35); thp = 0.8 + Math.sin(clock * 5 + b.phase) * 0.2;
            if (b.t <= 0) setState(b, here === 2 ? 'swim' : 'walk', 3 + rng() * 6);
            break;
          case 'graze': {
            thp = 1.35 + Math.sin(clock * 6 + b.phase) * 0.12; thy = Math.sin(clock * 0.7 + b.phase) * 0.3;
            b.tx = b.x + Math.sin(b.h) * 0.3; b.tz = b.z + Math.cos(b.h) * 0.3;
            if (steer(b, 0.12, DT, allowLand) < 0) b.h += 1.5;
            if (b.t <= 0) { setState(b, 'walk', 4 + rng() * 5); if (!newBankTarget(b, 4)) newWaterTarget(b, 8); }
            break;
          }
          case 'feed': {
            if (b.crumb < 0 || !cr.on[b.crumb]) { b.crumb = nearestCrumb(b); if (b.crumb >= 0 && cr.claimed[b.crumb] < 0) cr.claimed[b.crumb] = birds.indexOf(b); }
            if (b.crumb >= 0) {
              b.tx = cr.x[b.crumb]; b.tz = cr.z[b.crumb];
              const r = steer(b, (here === 2 ? kp.swim : kp.walk) * 2.2, DT, allowAny);
              if (Math.hypot(b.tx - b.x, b.tz - b.z) < 0.25 * b.scale + 0.15 || r === 1) {
                cr.on[b.crumb] = 0; b.crumb = -1; thp = 1.0; b.callT = Math.min(b.callT, rng() * 1.5);
              } else if (r === -1) b.crumb = -1;
            } else if (breadActive <= 0 || b.t <= 0) setState(b, 'swim', 2);
            else { thp = 0.4; }
            if (b.t <= 0) setState(b, 'swim', 2);
            break;
          }
          case 'flee': {
            const r = steer(b, (here === 2 ? kp.swim : kp.walk) * 3.2, DT, allowAny);
            flapA = b.kind === 'moorhen' ? Math.sin(clock * kp.flap) * 0.6 : 0; tspread = b.kind === 'moorhen' ? 0.6 : 0;
            if (r !== 0 || b.t <= 0) { setState(b, here === 2 ? 'swim' : 'walk', 3); newWaterTarget(b, 10); }
            break;
          }
          case 'fly': {
            const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
            const want = Math.atan2(dx, dz); let dh = want - b.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.h += Math.max(-2 * DT, Math.min(2 * DT, dh));
            const sp = Math.min(kp.fly, 1.5 + b.alt * 3);
            b.x += Math.sin(b.h) * sp * DT; b.z += Math.cos(b.h) * sp * DT;
            const wantAlt = d < 6 ? 0 : Math.min(4.5, d * 0.3);
            b.alt += Math.max(-1.6 * DT, Math.min(2.2 * DT, wantAlt - b.alt));
            tspread = 1; flapA = Math.sin(clock * kp.flap + b.phase) * 0.9 + 0.1; tpitch = -0.12;
            if (d < 0.8 && b.alt < 0.15) { b.alt = 0; setState(b, 'swim', 4); sounds.play('splash', dp); b.callT = 0.5; }
            else if (d < 0.8) { b.tx = b.x + Math.sin(b.h) * 2; b.tz = b.z + Math.cos(b.h) * 2; if (cellAt(b.tx, b.tz) !== 2) newWaterTarget(b, 6); }
            break;
          }
          case 'chase': {
            // swan: wings arched, neck back, advances on the player but never more than ~5 m from where it started
            tspread = 0.45; flapA = 0.55 + Math.sin(clock * 3) * 0.05; thp = -0.25;
            b.tx = P.x; b.tz = P.z;
            const far = Math.hypot(b.x - b.sx, b.z - b.sz) > 5;
            if (!far && dp > 0.9) steer(b, 1.5, DT, allowAny);
            else { const want = Math.atan2(P.x - b.x, P.z - b.z); let dh = want - b.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.h += Math.max(-2 * DT, Math.min(2 * DT, dh)); }
            if (dp < 1.0 && b.t > 0.5 && !b.nipped) { b.nipped = true; game.ui.toast('The swan nips your ankle. You deserve it.', 3); }
            if (b.t <= 0 || dp > 9) { b.nipped = false; setState(b, 'swim', 3); newWaterTarget(b, 8); }
            break;
          }
          case 'roost': {
            const r = steer(b, (here === 2 ? kp.swim : kp.walk) * 1.6, DT, allowAny);
            if (b.t <= 0 || r === 1 || r === -1 || Math.hypot(b.tx - b.x, b.tz - b.z) < 0.4) setState(b, 'sleep', 80);
            break;
          }
          case 'sleep':
            thy = (b.idx % 2 ? 1 : -1) * 2.75; thp = 0.55; b.speed = 0;
            if (!night && b.t <= 0) setState(b, 'swim', 0);
            break;
        }
        // ducklings: in daytime always follow
        if (b.kind === 'duckling' && b.state !== 'follow' && b.state !== 'flee') setState(b, 'follow', 1);
        // separation (cheap O(n^2), 30 birds)
        if (b.state !== 'fly') {
          for (const o of birds) {
            if (o === b || o.state === 'fly' || !o.visible) continue;
            const dx = b.x - o.x, dz = b.z - o.z, d2 = dx * dx + dz * dz, r = (b.kp.sep + o.kp.sep) * 0.5;
            if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2), push = (r - d) * 0.5; const nx = b.x + (dx / d) * push, nz = b.z + (dz / d) * push; if (cellAt(nx, nz)) { b.x = nx; b.z = nz; } }
          }
        }
        // calls
        if (b.callT <= 0) {
          b.callT = (b.state === 'sleep' ? 40 : 7) + rng() * 16;
          if (dp < 70 && b.state !== 'sleep') sounds.play(kp.call === 'drake' && rng() < 0.3 ? 'quack' : kp.call, dp);
        }
        // smooth pose
        const k = Math.min(1, DT * 6);
        let dy = thy - b.hy; b.hy += dy * k; b.hp += (thp - b.hp) * k; b.pitch += (tpitch - b.pitch) * Math.min(1, DT * 4);
        b.spread += (tspread - b.spread) * Math.min(1, DT * 5); b.flap = b.state === 'fly' || b.state === 'chase' || b.state === 'flee' ? flapA : b.flap * (1 - k);
        // height
        const cw = cellAt(b.x, b.z), onWater = cw === 2 || cw === 4;
        let y;
        if (b.state === 'fly') y = (onWater ? WATER_Y : SPECIES[b.kind].legH) + b.alt;
        else if (onWater) y = WATER_Y + Math.sin(clock * 2 + b.phase) * 0.006 - (b.state === 'sleep' ? 0.01 : 0);
        else y = b.state === 'sleep' ? SPECIES[b.kind].legH * 0.15 : SPECIES[b.kind].legH;
        b.y += (y - b.y) * Math.min(1, DT * 8);
        b.roll = !onWater && b.speed > 0.05 && b.state !== 'fly' ? Math.sin(clock * 11 + b.phase) * 0.09 : b.roll * 0.9;
      }
      // ---- write instances
      let w = 0;
      for (const b of birds) {
        const K = kinds[b.kind], i = b.idx;
        if (!b.visible) { K.im.setMatrixAt(i, _hide); }
        else {
          _e.set(b.pitch, b.h, b.roll, 'YXZ'); _q.setFromEuler(_e);
          _m.compose(_p.set(b.x, b.y, b.z), _q, _s.setScalar(b.scale));
          K.im.setMatrixAt(i, _m);
          K.pose.setXYZW(i, b.hy, b.hp, b.flap, b.spread);
        }
        // wake
        const cw2 = cellAt(b.x, b.z), onWater = b.visible && b.state !== 'fly' && (cw2 === 2 || cw2 === 4);
        const ws = onWater ? Math.min(1.2, b.speed * 1.4 + (b.state === 'dabble' ? 0.25 : 0)) * SPECIES[b.kind].body[0] * 9 * b.scale : 0;
        if (ws > 0.02) { _q.setFromAxisAngle(_p.set(0, 1, 0), b.h); _m.compose(_s.set(b.x, WATER_Y + 0.004, b.z), _q, _p.set(ws, 1, ws * 1.6)); wakes.setMatrixAt(w++, _m); }
      }
      wakes.count = w;
      for (const k of KIND_ORDER) { kinds[k].im.instanceMatrix.needsUpdate = true; kinds[k].pose.needsUpdate = true; }
      wakes.instanceMatrix.needsUpdate = true;
      let c = 0;
      for (let i = 0; i < NC; i++) if (cr.on[i]) { _q.setFromAxisAngle(_p.set(0, 1, 0), i); _m.compose(_s.set(cr.x[i], cr.y[i], cr.z[i]), _q, _p.set(1, 1, 1)); crumbs.setMatrixAt(c++, _m); }
      crumbs.count = c; crumbs.instanceMatrix.needsUpdate = true;
    },
  };
  return api;
}
