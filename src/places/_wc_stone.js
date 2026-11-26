// Walk-in rooms in old stone buildings (the Radcliffe Camera, the Divinity School, Christ Church): the pieces that
// places/_walkin_city.js does not have — windows in THICK walls with stone mullions and leaded / stained glass that the
// live world shows through, and the stone lining of a doorway through a thick wall. Room coordinates throughout.
// Everything here is named 'wc:win-*' / 'wc:reveal' (tools/smoke_walkin_city.mjs: "nothing of the room stands in the
// opening" ignores the glazing itself). Three shared materials for every such room.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let M = null;
export function stoneMats() {
  if (M) return M;
  M = {
    stone: new THREE.MeshLambertMaterial({ color: 0xcfc3a4, name: 'wc:win-stone' }),
    reveal: new THREE.MeshLambertMaterial({ color: 0xbfb393, side: THREE.DoubleSide, name: 'wc:reveal-stone' }),
    // leaded / stained glass: vertex colours, see-through (the world behind is tinted), no depth write
    glass: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, name: 'wc:win-stained' }),
    clear: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, name: 'wc:win-leaded' }),
    iron: new THREE.MeshLambertMaterial({ color: 0x1c1c1e, name: 'wc:win-iron' }),
  };
  return M;
}
const hash = (a, b = 0, c = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return h - Math.floor(h); };
const STAIN = [[0.72, 0.1, 0.1], [0.1, 0.2, 0.62], [0.85, 0.66, 0.12], [0.12, 0.45, 0.2], [0.9, 0.88, 0.8], [0.45, 0.12, 0.5], [0.9, 0.88, 0.8], [0.2, 0.5, 0.7]];

/**
 * Windows in a thick stone wall. ops: the plan's openings ({ at, out, w, y0, y1, depth }), each optionally with
 *   lights (stone mullions: number of lights, default by width), transoms: [heights above y0], head: metres of pointed
 *   head at the top that is filled with stone tracery bars (the opening itself stays a rectangle)
 * o: { noBars: glass only (the room has its own stone tracery), reveal: false, kind: 'stained' | 'leaded' | 'grille', y: floor offset, inset: 0..1 where in the wall the glass sits, seed, bar: mullion width }
 * -> THREE.Group (static; add to the room's scene)
 */
export function stoneWindows(ops, o = {}) {
  const Mt = stoneMats(), g = new THREE.Group(); g.name = 'wc:win-stonewindows';
  const kind = o.kind || 'leaded', inset = o.inset ?? 0.55, bw = o.bar ?? 0.12, yOff = o.y || 0;
  const GP = [], GC = [], RP = [], RN = [], boxes = [];
  const quad = (P, a, b, c, d) => { for (const v of [a, b, c, a, c, d]) P.push(v[0], v[1], v[2]); };
  ops.forEach((w, wi) => {
    const dx = Math.sin(w.out), dz = Math.cos(w.out), tx = Math.cos(w.out), tz = -Math.sin(w.out), D = (w.depth ?? 0.3), k = D * inset;
    const y0 = w.y0 + yOff, y1 = w.y1 + yOff, hw = w.w / 2;
    const pt = (s, y, e) => [w.at[0] + tx * s + dx * e, y, w.at[1] + tz * s + dz * e];
    // reveal (the opening lined out to the shell face)
    if (o.reveal !== false) { const E = D + 0.02; const rq = (a, b, c, d, n) => { quad(RP, a, b, c, d); for (let i = 0; i < 6; i++) RN.push(n[0], n[1], n[2]); };
      rq(pt(-hw, y0, 0), pt(-hw, y0, E), pt(-hw, y1, E), pt(-hw, y1, 0), [tx, 0, tz]); rq(pt(hw, y0, E), pt(hw, y0, 0), pt(hw, y1, 0), pt(hw, y1, E), [-tx, 0, -tz]);
      rq(pt(-hw, y0, 0), pt(hw, y0, 0), pt(hw, y0, E), pt(-hw, y0, E), [0, 1, 0]); rq(pt(-hw, y1, E), pt(hw, y1, E), pt(hw, y1, 0), pt(-hw, y1, 0), [0, -1, 0]); }
    // stone mullions, transoms, a simple traceried head; or an iron grille
    const lights = w.lights || Math.max(1, Math.round(w.w / 0.75)), lw = w.w / lights, rotY = Math.atan2(tx, tz) - Math.PI / 2;
    const box = (s, y, sw, sh, sd, mat) => { const b = new THREE.BoxGeometry(sw, sh, sd); b.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY).setPosition(...pt(s, y, k))); boxes.push([b, mat]); };
    if (kind === 'grille') {
      for (let i = 1; i < lights * 2; i++) box(-hw + (w.w * i) / (lights * 2), (y0 + y1) / 2, 0.035, y1 - y0, 0.035, 'iron');
      for (let y = y0 + 0.5; y < y1 - 0.2; y += 0.6) box(0, y, w.w, 0.035, 0.035, 'iron');
    } else if (!o.noBars) {
      for (let i = 1; i < lights; i++) box(-hw + lw * i, (y0 + y1) / 2, bw, y1 - y0, 0.22, 'stone');
      for (const t of w.transoms || []) box(0, y0 + t, w.w, bw, 0.22, 'stone');
      if (w.head) { const yh = y1 - w.head; box(0, yh, w.w, bw * 0.8, 0.2, 'stone');
        for (let i = 0; i < lights; i++) { const c = -hw + lw * (i + 0.5), b = new THREE.BoxGeometry(bw * 0.7, w.head * 1.05, 0.18), sl = (i + 0.5 < lights / 2 ? 1 : -1) * Math.min(0.5, (lw * 0.5) / w.head);
          b.applyMatrix4(new THREE.Matrix4().makeRotationZ(-sl)); b.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY).setPosition(...pt(c, yh + w.head / 2, k))); boxes.push([b, 'stone']); } }
    }
    // the glass: small panes (quarries), coloured by a hash for stained glass, pale for leaded lights
    const e = k - 0.02, rows = Math.max(2, Math.round((y1 - y0) / (kind === 'stained' ? 0.5 : 0.9)));
    for (let i = 0; i < lights; i++) for (let r = 0; r < rows; r++) {
      const s0 = -hw + lw * i + 0.03, s1 = -hw + lw * (i + 1) - 0.03, ya = y0 + ((y1 - y0) * r) / rows + 0.015, yb = y0 + ((y1 - y0) * (r + 1)) / rows - 0.015;
      let c;
      if (kind === 'stained') { const h = hash(wi + (o.seed || 0), i, r), border = r === 0 || r === rows - 1; c = border ? STAIN[4] : STAIN[Math.floor(h * STAIN.length) % STAIN.length]; }
      else { const h = hash(wi + (o.seed || 0), i * 3, r * 7); c = [0.86 + h * 0.1, 0.9 + h * 0.06, 0.82 + h * 0.12]; }
      quad(GP, pt(s0, ya, e), pt(s1, ya, e), pt(s1, yb, e), pt(s0, yb, e)); for (let q = 0; q < 6; q++) GC.push(c[0], c[1], c[2]);
    }
  });
  const add = (m) => { m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; g.add(m); return m; };
  if (RP.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(RP, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(RN, 3)); add(new THREE.Mesh(geo, Mt.reveal)).name = 'wc:reveal'; }
  for (const key of ['stone', 'iron']) { const list = boxes.filter((b) => b[1] === key).map((b) => b[0]); if (!list.length) continue; const geo = mergeGeometries(list, false); for (const b of list) b.dispose(); geo.deleteAttribute('uv'); add(new THREE.Mesh(geo, Mt[key])).name = 'wc:win-frame'; }
  if (GP.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(GP, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(GC, 3)); const m = add(new THREE.Mesh(geo, kind === 'stained' ? Mt.glass : Mt.clear)); m.name = 'wc:win-glass'; m.renderOrder = 2; }
  return g;
}

/** the stone lining of a doorway through a thick wall: jambs, soffit and threshold from the room's wall face out to the shell */
export function stonePassage(portal, o = {}) {
  const Mt = stoneMats(), P = [], N = [];
  const dx = Math.sin(portal.out), dz = Math.cos(portal.out), tx = Math.cos(portal.out), tz = -Math.sin(portal.out), D = (portal.depth ?? 0.3) + 0.02, hw = (portal.w || 1.1) / 2, y0 = portal.y || 0, y1 = y0 + (portal.h || 2.1);
  const B0 = -(o.back || 0);      // (start this far inside the wall face: a doorway at the corner of two faces)
  const pt = (s, y, e) => [portal.at[0] + tx * s + dx * (e || B0), y, portal.at[1] + tz * s + dz * (e || B0)];
  const rq = (a, b, c, d, n) => { for (const v of [a, b, c, a, c, d]) { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); } };
  rq(pt(-hw, y0, 0), pt(-hw, y0, D), pt(-hw, y1, D), pt(-hw, y1, 0), [tx, 0, tz]); rq(pt(hw, y0, D), pt(hw, y0, 0), pt(hw, y1, 0), pt(hw, y1, D), [-tx, 0, -tz]);
  rq(pt(-hw, y1, D), pt(hw, y1, D), pt(hw, y1, 0), pt(-hw, y1, 0), [0, -1, 0]);
  if (o.floor !== false) rq(pt(-hw, y0 + 0.004, 0), pt(hw, y0 + 0.004, 0), pt(hw, y0 + 0.004, D), pt(-hw, y0 + 0.004, D), [0, 1, 0]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  const m = new THREE.Mesh(geo, Mt.reveal); m.name = 'wc:reveal'; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false;
  return m;
}

/**
 * A plain stone room (floor, ceiling, four walls as inward-facing quads, one draw): x0..x1, z0..z1, y0..y0+h.
 * holes: [{ wall: 'n' (z0) | 's' (z1) | 'w' (x0) | 'e' (x1), c: centre along the wall (x or z), w, h }] doorways left open.
 */
export function stoneRoom({ x0, x1, z0, z1, y0 = 0, h = 3, holes = [], floor = true }) {
  const Mt = stoneMats(), P = [], N = [];
  const rq = (a, b, c, d, n) => { for (const v of [a, b, c, a, c, d]) { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); } };
  const y1 = y0 + h;
  if (floor) rq([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 1, 0]);
  rq([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, -1, 0]);
  const wall = (k, a, b, fix, n) => {
    const hs = holes.filter((q) => q.wall === k).sort((p, q) => p.c - q.c), P3 = (s, y) => (k === 'n' || k === 's' ? [s, y, fix] : [fix, y, s]);
    let s = a; const seg = (s0, s1, ya, yb) => { if (s1 - s0 > 0.01 && yb - ya > 0.01) rq(P3(s0, ya), P3(s1, ya), P3(s1, yb), P3(s0, yb), n); };
    for (const q of hs) { seg(s, q.c - q.w / 2, y0, y1); seg(q.c - q.w / 2, q.c + q.w / 2, y0 + q.h, y1); s = q.c + q.w / 2; }
    seg(s, b, y0, y1);
  };
  wall('n', x0, x1, z0, [0, 0, 1]); wall('s', x0, x1, z1, [0, 0, -1]); wall('w', z0, z1, x0, [1, 0, 0]); wall('e', z0, z1, x1, [-1, 0, 0]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  const m = new THREE.Mesh(geo, Mt.reveal); m.name = 'wc:stone-room'; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false;
  return m;
}
