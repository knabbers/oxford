// South Park fireworks night — what stands on the grass for the evening (built the first time it is needed, removed from
// the scene when the night is over): gate arches and crowd barriers, the funfair (gallopers, helter-skelter, big wheel,
// dodgems, stalls — all generic, with invented names), three food vans, the bonfire stack in its safety ring and the
// fenced firing site. Everything static is ONE mesh (vertex colours + per-vertex glow, _sp_fx.js fairMaterial), the two
// turning rides are one mesh each, all lettering is one mesh with one canvas atlas, all bulbs one Points.
import * as THREE from 'three';
import { SITE, hash } from './_sp_show.js';
import { fairMaterial, createBulbs } from './_sp_fx.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();

/** vertex-colour geometry builder: primitives are placed in a local frame set by at(x, z, heading) */
export class VB {
  constructor() { this.p = []; this.n = []; this.c = []; this.g = []; this.base = new THREE.Matrix4(); this.tris = 0; }
  at(x, z, h = 0, y = 0) { this.base.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, h, 0)), _s.set(1, 1, 1)); return this; }
  /** geo: any BufferGeometry; colour: hex or (triangleIndex) => hex; glow 0..1 or (tri) => 0..1 */
  add(geo, color, glow = 0, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position, N = g.attributes.normal;
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(1, 1, 1)).premultiply(this.base);
    const nm = new THREE.Matrix3().getNormalMatrix(_m);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); this.p.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); this.n.push(_v.x, _v.y, _v.z);
      const t = Math.floor(i / 3);
      _c.set(typeof color === 'function' ? color(t) : color); this.c.push(_c.r, _c.g, _c.b);
      this.g.push(typeof glow === 'function' ? glow(t) : glow);
    }
    this.tris += P.count / 3;
    if (g !== geo) g.dispose();
    return this;
  }
  box(w, h, d, x, y, z, color, glow = 0, ry = 0, rx = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, h, d), color, glow, x, y + h / 2, z, ry, rx, rz); }
  /** upright cylinder / cone frustum standing on y; rTop may be 0 */
  cyl(rTop, rBot, h, seg, x, y, z, color, glow = 0, open = false) { return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open), color, glow, x, y + h / 2, z); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.g, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------------------------------------ lettering
const SIGNS = [
  ['banner', 'SOUTH PARK FIREWORKS · TONIGHT', '#7a1414', '#f6e7b8'], ['entrance', 'ENTRANCE · FREE · PLEASE GIVE TO THE BUCKET', '#f4efe0', '#1c2a4a'],
  ['gallopers', 'THE GALLOPERS', '#b01818', '#ffe9a0'], ['helter', 'HELTER SKELTER', '#f0c020', '#8a1010'], ['wheel', 'BIG WHEEL', '#1a2f6a', '#fff0b0'],
  ['dodgems', 'DODGEMS', '#102a5a', '#ffd84a'], ['duck', 'HOOK-A-DUCK', '#f6d030', '#16407a'], ['coconut', 'COCONUT SHY', '#2a6a3a', '#fff2c8'],
  ['cans', 'TIN CAN ALLEY', '#b02020', '#ffffff'], ['floss', 'CANDY FLOSS · TOFFEE APPLES', '#f090b8', '#5a1030'], ['hoopla', 'HOOPLA · EVERY ONE A WINNER', '#6a2a8a', '#ffe070'],
  ['burger', 'BURGERS · HOT DOGS · ONIONS', '#f2efe4', '#a01818'], ['chips', 'FISH & CHIPS · MUSHY PEAS', '#1a3a6a', '#f6f0d8'], ['dough', 'HOT DOUGHNUTS · TEA · COFFEE', '#f6e0a0', '#6a3010'],
  ['keep', 'KEEP BACK · FIRING AREA', '#f0c010', '#141414'], ['fire', 'BONFIRE · KEEP BEHIND THE BARRIER', '#f0c010', '#141414'],
];
function signAtlas() {
  const W = 1024, RH = 64, c = document.createElement('canvas'); c.width = W; c.height = RH * SIGNS.length;
  const g = c.getContext('2d'), uv = {};
  SIGNS.forEach(([key, text, bg, fg], i) => {
    const y = i * RH;
    g.fillStyle = bg; g.fillRect(0, y, W, RH);
    g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(5, y + 5, W - 10, RH - 10);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 40px "Arial Black", Arial, sans-serif';
    g.fillText(text, W / 2, y + RH / 2 + 2, W - 40);
    uv[key] = [0, 1 - (y + RH) / c.height, 1, 1 - y / c.height];
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { texture: t, uv };
}
class SignBuf {
  constructor(uv) { this.uv = uv; this.p = []; this.t = []; this.i = []; this.base = new THREE.Matrix4(); }
  at(x, z, h = 0) { this.base.compose(_v.set(x, 0, z), _q.setFromEuler(_e.set(0, h, 0)), _s.set(1, 1, 1)); return this; }
  /** a board w x h centred at local (x, y, z), facing local +z turned by ry; both = also a back face */
  board(key, w, h, x, y, z, ry = 0, both = false) {
    const [u0, v0, u1, v1] = this.uv[key];
    for (const flip of both ? [0, 1] : [0]) {
      _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry + flip * Math.PI, 0)), _s.set(1, 1, 1)).premultiply(this.base);
      const b = this.p.length / 3;
      for (const [px, py] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) { _v.set(px, py, 0.02).applyMatrix4(_m); this.p.push(_v.x, _v.y, _v.z); }
      this.t.push(u0, v0, u1, v0, u1, v1, u0, v1); this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  geometry() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.t, 2)); g.setIndex(this.i); g.computeBoundingSphere(); return g; }
}

// crowd barrier: a run of low steel hurdles from a to b
function barrier(vb, ax, az, bx, bz, color = 0xb8bcc0, every = 1) {
  const len = Math.hypot(bx - ax, bz - az), h = Math.atan2(bx - ax, bz - az);
  vb.at((ax + bx) / 2, (az + bz) / 2, h);
  vb.box(0.05, 0.05, len, 0, 1.05, 0, color); vb.box(0.05, 0.05, len, 0, 0.18, 0, color);
  const n = Math.max(1, Math.round(len / every));
  for (let i = 0; i <= n; i++) vb.box(0.03, 1.05, 0.03, 0, 0, -len / 2 + (i / n) * len, color);
}
const STRIPE = (a, b, per = 1) => (t) => (Math.floor(t / (2 * per)) % 2 ? a : b);
const W2 = (x, z, h, lx, lz) => [x + lx * Math.cos(h) + lz * Math.sin(h), z - lx * Math.sin(h) + lz * Math.cos(h)];

/**
 * -> {group, fair (uniforms: uOn), bulbs, rotors: [{obj, axis, w}], colliders: [...], obstacles: [[x, z, r]], spots: {stewards, stalls, vans, collector}, tris}
 * Nothing is added to the scene or the collider's live set here: the caller shows `group` and switches `colliders` on.
 */
export function buildEvent(game) {
  const col = game.worldCollider, group = new THREE.Group(); group.name = 'southpark:event';
  const vb = new VB(), fair = fairMaterial(), atlas = signAtlas(), sg = new SignBuf(atlas.uv), bulbs = [], colliders = [], obstacles = [];
  const solid = (s) => { for (const q of Array.isArray(s) ? s : [s]) if (q) { q.on = false; colliders.push(q); } };
  const bulbRow = (pts, colr, n, size = 0.22) => { for (let i = 0; i < n; i++) { const f = n === 1 ? 0 : i / (n - 1), k = f * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(k)), t = k - j, a = pts[j], b = pts[j + 1]; const c = Array.isArray(colr[0]) ? colr[i % colr.length] : colr; bulbs.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, c[0], c[1], c[2], (i * 0.37) % 1, size]); } };
  const WARM = [1, 0.82, 0.45], RED = [1, 0.25, 0.2], BLU = [0.4, 0.6, 1], GRN = [0.4, 1, 0.5], MIX = [WARM, RED, WARM, BLU, WARM, GRN];
  const [fx, fz] = SITE.fair;

  // ---- gates: two posts, a banner across, hurdles funnelling people in
  for (const [x, z, h] of SITE.gates) {
    vb.at(x, z, h);
    for (const sx of [-3.2, 3.2]) { vb.cyl(0.09, 0.11, 4.6, 8, sx, 0, 0, 0x2a2e36); vb.box(0.7, 0.12, 0.7, sx, 0, 0, 0x3a3a3a); }
    vb.box(6.6, 0.08, 0.08, 0, 4.5, 0, 0x2a2e36); vb.box(6.4, 1.0, 0.06, 0, 3.45, 0, 0x7a1414, 0.5);
    sg.at(x, z, h).board('banner', 6.3, 0.9, 0, 3.95, 0.035, 0, false); sg.board('banner', 6.3, 0.9, 0, 3.95, -0.035, Math.PI, false);
    sg.board('entrance', 3.6, 0.42, 0, 3.05, 0.03, 0, true);
    for (const sx of [-1, 1]) { const a = W2(x, z, h, sx * 3.2, 0), b = W2(x, z, h, sx * 6.5, -5.5); barrier(vb, a[0], a[1], b[0], b[1]); solid(col.addSegment(a[0], a[1], b[0], b[1], { tag: 'barrier', low: true })); solid(col.addCircle(a[0], a[1], 0.3)); }
    const p0 = W2(x, z, h, -3.2, 0), p1 = W2(x, z, h, 3.2, 0);
    bulbRow([[p0[0], 4.62, p0[1]], [p1[0], 4.62, p1[1]]], WARM, 12);
  }

  // ---- the gallopers (carousel): static deck + turning top
  const CAR = [fx, fz - 4];
  vb.at(CAR[0], CAR[1], 0);
  vb.cyl(6.6, 6.8, 0.45, 24, 0, 0, 0, STRIPE(0x8a1818, 0xe8dcc0));
  vb.cyl(0.9, 0.9, 5.2, 12, 0, 0.45, 0, STRIPE(0xd8b030, 0xb02020), 0.35);
  solid(col.addCircle(CAR[0], CAR[1], 7)); obstacles.push([CAR[0], CAR[1], 8]);
  const rot = new VB(); rot.at(0, 0, 0);
  rot.cyl(0, 7.1, 2.6, 24, 0, 5.7, 0, STRIPE(0xc02020, 0xf2e6c4), 0.12, true);
  rot.cyl(7.1, 7.1, 0.9, 24, 0, 4.85, 0, STRIPE(0xf0c840, 0xfff2c8), 0.9, true);     // lit rounding boards
  rot.cyl(0.25, 0.25, 0.8, 8, 0, 8.3, 0, 0xd8b030, 0.6); rot.cyl(6.3, 6.3, 0.12, 24, 0, 0.47, 0, 0x6a4a2a);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, r = i % 2 ? 5.4 : 4.0, x = Math.cos(a) * r, z = Math.sin(a) * r, up = 0.25 + 0.5 * hash(i, 3), hc = [0xf2f2ec, 0x3a2a20, 0xc8a070, 0x1a1a1a, 0xd8d0c0][i % 5];
    rot.cyl(0.035, 0.035, 4.3, 6, x, 0.55, z, 0xd8b848, 0.3);
    rot.box(0.34, 0.5, 1.25, x, 1.0 + up, z, hc, 0, -a); rot.box(0.2, 0.55, 0.3, x - Math.sin(-a) * 0.62, 1.45 + up, z - Math.cos(-a) * 0.62, hc, 0, -a, -0.5);
    rot.box(0.36, 0.1, 0.5, x, 1.5 + up, z, [0xb02020, 0x2040a0, 0x208040][i % 3], 0, -a);
  }
  const carousel = new THREE.Mesh(rot.geometry(), fair.material); carousel.position.set(CAR[0], 0, CAR[1]); carousel.name = 'southpark:gallopers';
  sg.at(CAR[0], CAR[1], 0); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; sg.board('gallopers', 4.6, 0.6, Math.sin(a) * 7.25, 6.05, Math.cos(a) * 7.25, a); }

  // ---- helter-skelter
  const HS = [fx - 27, fz + 10];
  vb.at(HS[0], HS[1], 0);
  vb.cyl(2.1, 3.3, 13.5, 16, 0, 0, 0, STRIPE(0xc82020, 0xf4d030));
  vb.cyl(2.9, 2.9, 0.25, 16, 0, 13.5, 0, 0x2a2a6a); vb.cyl(0, 2.7, 3.2, 16, 0, 15.9, 0, STRIPE(0x2040a0, 0xf2e6c4), 0, true); vb.cyl(2.5, 2.5, 2.2, 8, 0, 13.7, 0, 0xf2e6c4, 0.5, true);
  vb.cyl(0.04, 0.04, 2.2, 5, 0, 19.1, 0, 0x2a2a2a); vb.box(0.02, 0.6, 1.0, 0, 20.6, 0.5, 0xc02020);
  { const turns = 3.2, n = 46, spiral = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), a = f * turns * Math.PI * 2, y = 12.2 - f * 11.4, r = 2.3 + (1 - y / 13.5) * 1.2 + 0.95;
      vb.box(1.25, 0.12, 1.5, Math.cos(a) * r, y, Math.sin(a) * r, 0x2f6fb8, 0, -a, 0, 0.12); vb.box(0.08, 0.55, 1.5, Math.cos(a) * (r + 0.62), y, Math.sin(a) * (r + 0.62), 0xf4d030, 0, -a);
      if (i % 2 === 0) spiral.push([HS[0] + Math.cos(a) * (r + 0.7), y + 0.7, HS[1] + Math.sin(a) * (r + 0.7)]);
    }
    bulbRow(spiral, [WARM, RED], 44); }
  vb.box(3.2, 2.4, 2.2, 0, 0, 4.2, 0xf2e6c4); vb.box(3.4, 0.2, 2.5, 0, 2.4, 4.2, 0xc82020);
  sg.at(HS[0], HS[1], 0).board('helter', 3.0, 0.5, 0, 2.05, 5.33, 0);
  solid(col.addCircle(HS[0], HS[1], 5.1)); solid(col.addBox(HS[0], HS[1] + 4.2, 3.2, 2.2)); obstacles.push([HS[0], HS[1], 6.5]);

  // ---- big wheel: A-frames (static) + the wheel (turns about its axle)
  const BW = [fx + 30, fz - 8], WR = 8.5, AX = 10.2;
  vb.at(BW[0], BW[1], 0);
  for (const sz of [-1.5, 1.5]) for (const sx of [-1, 1]) vb.box(0.3, AX + 0.6, 0.3, sx * 2.7, 0, sz, 0x2f4f9a, 0, 0, 0, -sx * 0.26);
  vb.box(0.3, 0.3, 3.4, 0, AX - 0.15, 0, 0x202020); vb.box(8.5, 0.35, 5.5, 0, 0, 0, 0x55504a);
  vb.box(2.6, 2.3, 1.8, -6.2, 0, 0, 0xf2e6c4); vb.box(2.8, 0.18, 2.0, -6.2, 2.3, 0, 0x1a2f6a);
  sg.at(BW[0], BW[1], 0).board('wheel', 2.5, 0.42, -6.2, 1.95, 0.93, 0);
  const wv = new VB(); wv.at(0, 0, 0);
  for (const sz of [-1.1, 1.1]) {
    wv.add(new THREE.TorusGeometry(WR, 0.09, 4, 28), 0xe8e2d0, 0.75, 0, 0, sz);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; wv.add(new THREE.BoxGeometry(0.07, WR, 0.07), 0xd0d4dc, 0.25, Math.cos(a) * WR / 2, Math.sin(a) * WR / 2, sz, 0, 0, a - Math.PI / 2); }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * WR, y = Math.sin(a) * WR;
    wv.add(new THREE.BoxGeometry(0.06, 0.06, 2.2), 0xd0d4dc, 0, x, y, 0);
    wv.add(new THREE.SphereGeometry(0.85, 8, 6), [0xc82020, 0xf4d030, 0x2f6fb8, 0x30a050][i % 4], 0.3, x, y, 0);     // round pods: no "which way is up" as the wheel turns
  }
  const wheel = new THREE.Mesh(wv.geometry(), fair.material); wheel.position.set(BW[0], AX, BW[1]); wheel.name = 'southpark:wheel';
  solid(col.addBox(BW[0], BW[1], 9, 5.6)); solid(col.addBox(BW[0] - 6.2, BW[1], 2.6, 1.8)); obstacles.push([BW[0], BW[1], 7]);

  // ---- dodgems: a flat roof on posts over a steel floor, cars parked up
  const DG = [fx + 2, fz + 30];
  vb.at(DG[0], DG[1], 0);
  vb.box(16, 0.3, 10, 0, 0, 0, 0x4a4e58); vb.box(16.6, 0.35, 10.6, 0, 4.0, 0, 0x102a5a); vb.box(16.8, 0.7, 0.12, 0, 3.6, 5.3, 0x102a5a, 0.3);
  for (const sx of [-7.8, 0, 7.8]) for (const sz of [-4.8, 4.8]) vb.cyl(0.1, 0.1, 3.8, 6, sx, 0.3, sz, 0xd8b030);
  for (let i = 0; i < 9; i++) { const x = -6 + (i % 5) * 3 + (i > 4 ? 1.4 : 0), z = i > 4 ? 2.2 : -2.0, cc = [0xc82020, 0x2f6fb8, 0xf4d030, 0x30a050, 0xe07020][i % 5]; vb.box(1.3, 0.55, 1.9, x, 0.3, z, cc, 0.15, hash(i, 9) * 3); vb.cyl(0.02, 0.02, 2.9, 4, x, 0.85, z + 0.6, 0x909090); vb.box(1.5, 0.16, 2.1, x, 0.3, z, 0x1a1a1a, 0, hash(i, 9) * 3); }
  sg.at(DG[0], DG[1], 0).board('dodgems', 6, 0.6, 0, 3.95, 5.38, 0); sg.board('dodgems', 6, 0.6, 0, 3.95, -5.38, Math.PI);
  { const y = 4.42, hx = 8.3, hz = 5.3; bulbRow([[DG[0] - hx, y, DG[1] - hz], [DG[0] + hx, y, DG[1] - hz], [DG[0] + hx, y, DG[1] + hz], [DG[0] - hx, y, DG[1] + hz], [DG[0] - hx, y, DG[1] - hz]], MIX, 56); }
  solid(col.addBox(DG[0], DG[1], 16, 10)); obstacles.push([DG[0], DG[1], 9.5]);

  // ---- stalls: a striped booth with a counter; [key, x, z, heading, canopy colours, something on show]
  const stalls = [['duck', fx - 26, fz - 28, 0, 0x2f6fb8, 0xf4d030], ['coconut', fx - 15, fz - 29, 0, 0x30a050, 0xf2e6c4], ['cans', fx - 4, fz - 30, 0, 0xc82020, 0xf2e6c4],
    ['floss', fx + 7, fz - 30, 0, 0xf090b8, 0xf2e6c4], ['hoopla', fx + 42, fz + 12, -Math.PI / 2, 0x6a2a8a, 0xf4d030]];
  const spots = { stewards: [], stalls: [], vans: [], collector: null };
  for (const [key, x, z, h, ca, cb] of stalls) {
    vb.at(x, z, h);
    vb.box(4.4, 0.95, 0.5, 0, 0, 1.3, cb); vb.box(4.4, 0.06, 0.7, 0, 0.95, 1.3, 0x6a4a2a);
    vb.box(4.4, 2.6, 0.08, 0, 0, -1.4, ca); vb.box(0.08, 2.6, 2.8, -2.2, 0, 0, cb); vb.box(0.08, 2.6, 2.8, 2.2, 0, 0, cb);
    for (let i = 0; i < 6; i++) vb.box(0.76, 0.08, 3.4, -1.9 + i * 0.76, 2.6 + 0.0, 0.2, i % 2 ? ca : cb, 0.1, 0, -0.12);
    vb.box(4.6, 0.5, 0.06, 0, 2.2, 1.95, ca, 0.35);
    for (let i = 0; i < 7; i++) vb.box(0.3, 0.3, 0.3, -1.8 + i * 0.6, 1.35 + (i % 2) * 0.5, -1.2, [0xf4d030, 0xc82020, 0x30a050, 0x2f6fb8, 0xf090b8][i % 5], 0.2);
    sg.at(x, z, h).board(key, 4.3, 0.42, 0, 2.45, 2.0, 0);
    const a = W2(x, z, h, -2.2, 2.0), b = W2(x, z, h, 2.2, 2.0);
    bulbRow([[a[0], 2.78, a[1]], [b[0], 2.78, b[1]]], MIX, 10);
    solid(col.addBox(x, z, 4.5, 3.2, h));
    const st = W2(x, z, h, 0.4, 0.2); spots.stalls.push([st[0], st[1], h]);
  }

  // ---- food vans: box van, hatch lit from inside, flue
  const vans = [['burger', SITE.bonfire[0] - 62, SITE.bonfire[1] + 34, 0.25, 0xf2efe4], ['chips', SITE.bonfire[0] - 50, SITE.bonfire[1] + 38, 0.15, 0x1a3a6a], ['dough', SITE.bonfire[0] - 38, SITE.bonfire[1] + 41, 0.05, 0xf6e0a0]];
  for (const [key, x, z, h0, body] of vans) {
    const h = h0 + Math.PI;                      // hatch side (+z local) faces north, towards the field
    vb.at(x, z, h);
    vb.box(5.6, 2.3, 2.3, 0, 0.5, 0, body); vb.box(5.7, 0.1, 2.4, 0, 2.8, 0, 0xd8d8d8);
    vb.box(3.4, 1.1, 0.06, 0.3, 1.45, 1.16, 0xffe2a0, 1.0);                                  // the open hatch: warm light
    vb.box(3.6, 0.07, 1.3, 0.3, 2.6, 1.75, body, 0, 0, 0.28); vb.box(3.5, 0.06, 0.45, 0.3, 1.38, 1.36, 0x8a8a8a);
    for (const sx of [-1.9, 1.9]) vb.cyl(0.38, 0.38, 0.28, 10, sx, 0.02, 0, 0x151515); vb.cyl(0.1, 0.1, 0.9, 6, -2.2, 2.9, -0.5, 0x777777);
    sg.at(x, z, h).board(key, 5.2, 0.5, 0, 2.52, 1.185, 0);
    const a = W2(x, z, h, -2.6, 1.2), b = W2(x, z, h, 2.6, 1.2); bulbRow([[a[0], 2.84, a[1]], [b[0], 2.84, b[1]]], WARM, 8);
    solid(col.addBox(x, z, 5.6, 2.3, h));
    const st = W2(x, z, h, 0.3, 0.2); spots.vans.push([st[0], st[1], h, W2(x, z, h, 0.3, 2.2)]);
  }

  // ---- festoon lights over the fair, on poles
  { const poles = [[fx - 34, fz - 20], [fx - 12, fz - 18], [fx + 14, fz - 20], [fx + 40, fz - 2], [fx + 26, fz + 20], [fx - 8, fz + 16], [fx - 34, fz - 20]];
    for (const [x, z] of poles.slice(0, -1)) { vb.at(x, z, 0); vb.cyl(0.06, 0.08, 5.6, 6, 0, 0, 0, 0x30343c); }
    for (let i = 0; i < poles.length - 1; i++) { const a = poles[i], b = poles[i + 1], mid = [(a[0] + b[0]) / 2, 4.6, (a[1] + b[1]) / 2]; bulbRow([[a[0], 5.5, a[1]], mid, [b[0], 5.5, b[1]]], MIX, 14, 0.2); } }

  // ---- the bonfire: a stack of pallets and timber, a ring of barriers
  const [bx, bz] = SITE.bonfire, BR = SITE.bonfireR;
  vb.at(bx, bz, 0);
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + hash(i, 1) * 0.3, r = 2.6 + hash(i, 2) * 1.2, len = 6.5 + hash(i, 4) * 2.2; vb.add(new THREE.BoxGeometry(0.14, len, 0.28 + hash(i, 5) * 0.3), [0x5a4028, 0x6a4a2c, 0x4a3420][i % 3], 0, Math.cos(a) * r * 0.55, len * 0.42, Math.sin(a) * r * 0.55, -a, 0, 0.36 + hash(i, 6) * 0.14); }
  for (let i = 0; i < 9; i++) { const a = hash(i, 7) * 6.28, r = 1.2 + hash(i, 8) * 2.6; vb.box(1.2, 0.16, 1.0, Math.cos(a) * r, 0.1 + (i % 4) * 0.2, Math.sin(a) * r, 0x7a5a36, 0, a); }
  vb.cyl(2.6, 4.3, 1.5, 10, 0, 0, 0, 0x3e2c1c);
  for (let i = 0; i < 26; i++) { const a0 = (i / 26) * Math.PI * 2, a1 = ((i + 1) / 26) * Math.PI * 2; if (i % 13 === 6) continue; barrier(vb, bx + Math.cos(a0) * BR, bz + Math.sin(a0) * BR, bx + Math.cos(a1) * BR, bz + Math.sin(a1) * BR); }
  sg.at(bx, bz, 0); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.3; sg.board('fire', 3.2, 0.34, Math.sin(a) * (BR + 0.06), 0.62, Math.cos(a) * (BR + 0.06), a); }
  solid(col.addCircle(bx, bz, BR)); obstacles.push([bx, bz, BR + 1.5]);

  // ---- the firing site: a fenced strip of mortar racks
  const [lx, lz] = SITE.launch, LH = SITE.launchHalf + 9, LW = 16;
  for (const [a, b] of [[[-LW, -LH], [LW, -LH]], [[LW, -LH], [LW, LH]], [[LW, LH], [-LW, LH]], [[-LW, LH], [-LW, -LH]]]) {
    barrier(vb, lx + a[0], lz + a[1], lx + b[0], lz + b[1], 0xe08020, 3.4);      // (seen from 100 m and more: one long run a side)
  }
  vb.at(lx, lz, 0);
  for (let i = 0; i < 16; i++) { const z = -SITE.launchHalf + (i / 15) * SITE.launchHalf * 2; vb.box(1.6, 0.5, 0.7, (i % 2) * 2.2 - 1.1, 0, z, 0x3a3226); for (let j = 0; j < 4; j++) vb.cyl(0.07, 0.07, 0.75, 6, (i % 2) * 2.2 - 1.1 - 0.6 + j * 0.4, 0.35, z, 0x1c1c1c); }
  sg.at(lx, lz, 0).board('keep', 3.4, 0.36, -LW - 0.06, 0.62, 0, -Math.PI / 2); sg.board('keep', 3.4, 0.36, -LW - 0.06, 0.62, -20, -Math.PI / 2); sg.board('keep', 3.4, 0.36, -LW - 0.06, 0.62, 20, -Math.PI / 2);
  solid(col.addBox(lx, lz, LW * 2, LH * 2));

  // ---- where the staff stand
  SITE.gates.forEach(([x, z, h], i) => { const a = W2(x, z, h, -4.6, 1.5), b = W2(x, z, h, 4.4, 2.2); spots.stewards.push([a[0], a[1], h + Math.PI]); if (i === 0) { spots.stewards.push([b[0], b[1], h + Math.PI]); const c = W2(x, z, h, 1.6, 4.5); spots.collector = [c[0], c[1], h + Math.PI]; } });
  spots.stewards.push([bx - BR - 1.2, bz + 2, -Math.PI / 2], [lx - LW - 2.5, lz - 6, -Math.PI / 2]);

  const stat = new THREE.Mesh(vb.geometry(), fair.material); stat.name = 'southpark:fair'; stat.matrixAutoUpdate = false; stat.castShadow = false; stat.receiveShadow = false;
  const signs = new THREE.Mesh(sg.geometry(), new THREE.MeshBasicMaterial({ map: atlas.texture, fog: false })); signs.name = 'southpark:signs'; signs.matrixAutoUpdate = false;
  const bl = createBulbs(bulbs);
  for (const m of [carousel, wheel]) { m.castShadow = false; m.receiveShadow = false; }
  group.add(stat, signs, carousel, wheel, bl.mesh);
  return {
    group, fair: fair.u, signs, bulbs: bl, colliders, obstacles, spots,
    rotors: [{ obj: carousel, axis: 'y', w: 0.42 }, { obj: wheel, axis: 'z', w: 0.2 }],
    tris: vb.tris + rot.tris + wv.tris + sg.i.length / 3, nBulbs: bulbs.length,
    pools: [[CAR[0], CAR[1], 13], [HS[0], HS[1], 10], [BW[0], BW[1], 13], [DG[0], DG[1], 13], [fx - 12, fz - 26, 14], [SITE.bonfire[0] - 50, SITE.bonfire[1] + 34, 13]],
  };
}
