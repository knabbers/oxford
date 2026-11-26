// Christ Church Meadow — a rowing eight training on the Isis below the meadow, on the shared clock (everyone sees the
// same boat at the same place, stroke for stroke). ONE mesh: a 17 m shell, eight rowers and a cox, eight oars; the
// stroke is animated in the vertex shader (oars sweep and lift about their gates, rowers slide and swing), so the CPU
// only moves the boat. Drawn only within ~300 m.
//
// The crew rows the reach between Folly Bridge and the old Cherwell mouth (the part of the river inside the map),
// easies, spins and comes back: a 4.4 m/s paddle-to-firm piece each way. A pure function of time: eightAt(path, tMs).
import * as THREE from 'three';

export const EIGHT = { speed: 4.4, rate: 30, turn: 40, gap: 50, len: 17.2 };   // m/s, strokes/min, s spinning, s resting

/** the river's centre line on the meadow reach: the mapped Thames line clipped to the map */
export function eightPath(map) {
  const w = map.waterlines.find((q) => q.id === 'w413977879'); if (!w) return null;
  const pts = w.pts.filter(([x, z]) => x > 300 && z < 1212);
  if (pts.length < 2) return null;
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, L: cum[cum.length - 1] - 12 };
}
function along(P, s, out) {
  s = Math.max(6, Math.min(P.L, s));
  let i = 1; while (i < P.cum.length - 1 && P.cum[i] < s) i++;
  const a = P.pts[i - 1], b = P.pts[i], l = P.cum[i] - P.cum[i - 1] || 1, t = (s - P.cum[i - 1]) / l;
  out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t; out.dir = Math.atan2(b[0] - a[0], b[1] - a[1]);
  return out;
}
/** where the eight is at shared time tMs: {x, z, h, rowing 0..1, stroke (phase, radians), on} */
export function eightAt(P, tMs, out = {}) {
  const run = P.L / EIGHT.speed, cycle = 2 * (run + EIGHT.turn) + EIGHT.gap, t = ((tMs / 1000) % cycle + cycle) % cycle;
  let s, fwd, rowing, spin = 0;
  if (t < run) { s = (t / run) * P.L; fwd = 1; rowing = 1; }
  else if (t < run + EIGHT.turn) { s = P.L; fwd = 1; rowing = 0; spin = (t - run) / EIGHT.turn; }
  else if (t < 2 * run + EIGHT.turn) { s = P.L * (1 - (t - run - EIGHT.turn) / run); fwd = -1; rowing = 1; }
  else if (t < 2 * run + 2 * EIGHT.turn) { s = 0; fwd = -1; rowing = 0; spin = (t - 2 * run - EIGHT.turn) / EIGHT.turn; }
  else { s = 0; fwd = 1; rowing = 0; spin = 1; }                                       // resting at the top of the reach
  along(P, s, out);
  const e = spin * spin * (3 - 2 * spin);
  out.h = out.dir + (fwd > 0 ? 0 : Math.PI) + e * Math.PI * (rowing ? 0 : 1);
  if (t >= 2 * run + 2 * EIGHT.turn) out.h = out.dir;
  // a little easing at the ends of a piece
  out.rowing = rowing ? Math.min(1, t % (run + EIGHT.turn) / 4, (run - (t % (run + EIGHT.turn))) / 4) : 0;
  out.stroke = (tMs / 1000) * (EIGHT.rate / 60) * 2 * Math.PI;
  out.on = true;
  return out;
}

const GLSL = /* glsl */`
attribute float aPart; attribute vec3 aPivot; attribute float aSide;
uniform float uStroke; uniform float uRow;
mat3 rY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
vec3 eightXf(vec3 p) {
  float ph = uStroke, drive = 0.5 + 0.5 * sin(ph), lift = smoothstep(-0.1, 0.4, cos(ph));      // blade in the water on the drive
  if (aPart > 1.5) {                       // oars: sweep about the gate, blade lifted on the recovery
    float sweep = mix(0.0, (drive - 0.5) * 1.15, uRow) * aSide;
    float raise = mix(0.08, 0.08 - 0.13 * lift, uRow) * aSide;
    return rY(sweep) * rZ(raise) * (p - aPivot) + aPivot;
  }
  if (aPart > 0.5) {                       // rowers: slide and swing with the stroke
    float sw = (drive - 0.5) * 0.5 * uRow;
    vec3 q = p; q.z += sw * 0.4; q.z += (p.y - aPivot.y) * sw * 0.5;
    return q;
  }
  return p;
}
`;
export function createEight() {
  const pos = [], nor = [], col = [], part = [], piv = [], side = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Color();
  const add = (geo, color, p, pv = [0, 0, 0], sd = 0, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position, N = g.attributes.normal;
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    const nm = new THREE.Matrix3().getNormalMatrix(_m); _c.set(color);
    for (let i = 0; i < P.count; i++) { _v.fromBufferAttribute(P, i).applyMatrix4(_m); pos.push(_v.x, _v.y, _v.z); _n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(_n.x, _n.y, _n.z); col.push(_c.r, _c.g, _c.b); part.push(p); piv.push(...pv); side.push(sd); }
    if (g !== geo) g.dispose(); geo.dispose();
  };
  // shell: a long narrow hull, pointed both ends (a squashed cylinder), white with a varnished deck strip
  add(new THREE.CylinderGeometry(0.29, 0.29, EIGHT.len, 10, 1), 0xf2f0ea, 0, undefined, 0, 0, 0.12, 0, Math.PI / 2, 0, 0, 1, 1, 0.42);
  add(new THREE.ConeGeometry(0.29, 1.4, 10), 0xf2f0ea, 0, undefined, 0, 0, 0.12, EIGHT.len / 2 + 0.7, Math.PI / 2, 0, 0, 1, 1, 0.42);
  add(new THREE.ConeGeometry(0.29, 1.4, 10), 0xf2f0ea, 0, undefined, 0, 0, 0.12, -EIGHT.len / 2 - 0.7, -Math.PI / 2, 0, 0, 1, 1, 0.42);
  add(new THREE.BoxGeometry(0.22, 0.02, EIGHT.len * 0.95), 0x8a5a2a, 0, undefined, 0, 0, 0.24, 0);
  const kit = 0x1b2a5a, skin = 0xd9a885, blade = 0x1b2a5a;
  for (let k = 0; k < 8; k++) {
    const z = 5.9 - k * 1.42, sd = k % 2 ? 1 : -1, P = [0, 0.75, z];
    add(new THREE.BoxGeometry(0.34, 0.5, 0.22), kit, 1, P, 0, 0, 0.62, z - 0.1);                     // torso
    add(new THREE.SphereGeometry(0.11, 8, 6), skin, 1, P, 0, 0, 1.0, z - 0.12);                      // head
    add(new THREE.BoxGeometry(0.3, 0.12, 0.5), 0x222222, 1, P, 0, 0, 0.35, z + 0.25);                 // legs
    add(new THREE.BoxGeometry(0.66, 0.03, 0.04), 0x9a9a9a, 0, undefined, 0, sd * 0.33, 0.4, z + 0.2); // rigger
    // oar from the gate at the rigger's end: loom across the boat to the handle, blade out over the water
    const gx = sd * 0.66, gp = [gx, 0.42, z + 0.2];
    add(new THREE.CylinderGeometry(0.02, 0.02, 3.7, 5), 0xe0e0e0, 2, gp, sd, gx + sd * 1.1, 0.42, z + 0.2, 0, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(0.5, 0.02, 0.22), blade, 2, gp, sd, gx + sd * 2.85, 0.42, z + 0.2);
  }
  add(new THREE.BoxGeometry(0.32, 0.4, 0.3), 0x3a3a3a, 1, [0, 0.6, -6.6], 0, 0, 0.4, -6.6);   // cox
  add(new THREE.SphereGeometry(0.1, 8, 6), skin, 1, [0, 0.6, -6.6], 0, 0, 0.72, -6.6);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1)); g.setAttribute('aPivot', new THREE.Float32BufferAttribute(piv, 3)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.computeBoundingSphere(); g.boundingSphere.radius += 4;
  const u = { uStroke: { value: 0 }, uRow: { value: 0 } };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, name: 'ccm:eight' });
  mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u); sh.vertexShader = GLSL + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = eightXf(position);'); };
  mat.customProgramCacheKey = () => 'ccm-eight';
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'ccm:eight'; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false; mesh.visible = false;
  return { mesh, uniforms: u, tris: pos.length / 9 };
}
