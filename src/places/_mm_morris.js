// May Morning — a Morris side: six dancers and a musician, real characters animated on the character rig.
// The figure each dancer is in, where they are and when sticks meet come from _mm_rules.js morrisAt(i, beat) with
// beat = shared clock / JIG.beat, so every player sees the same step on the same beat of the same tune, and the
// stick clack in _mm_audio.js lands when the sticks do. Layered on the rig AFTER character.update() through
// character.bones (docs/CHARACTERS_API.md): step-hop legs, carried / clashing stick arm or handkerchief flicks.
// Kit (GUESS, generic Cotswold): whites, crossed baldrics, bell pads on the shins, straw hats; no real side's colours.
import * as THREE from 'three';
import { createCharacter, randomLook } from '../core/characters.js';
import { morrisAt, hash } from './_mm_rules.js';

const KIT = {
  sticks: { sash: [0x1f7a3a, 0xe8c020], hat: 'sunhat', hatColor: 0xd8c890, bottom: 0x1a1a1e, legs: 'shorts' },
  hankies: { sash: [0xb02020, 0x2040a0], hat: 'sunhat', hatColor: 0xe0d0a0, bottom: 0xf0eee6, legs: 'trousers' },
};
let MAT = null;
const mat = () => MAT || (MAT = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
function box(w, h, d, color, x = 0, y = 0, z = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d); if (rz) g.rotateZ(rz); g.translate(x, y, z);
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function merge(list) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), I = new Uint16Array(ni); let v = 0, k = 0;
  for (const g of list) { P.set(g.attributes.position.array, v * 3); N.set(g.attributes.normal.array, v * 3); C.set(g.attributes.color.array, v * 3); for (let i = 0; i < g.index.count; i++) I[k++] = g.index.array[i] + v; v += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.setIndex(new THREE.BufferAttribute(I, 1));
  return out;
}
// direction of a stick in the forearm's frame (the forearm hangs along -y): an extension of the forearm, canted forward and across
const STICK_DIR = new THREE.Vector3(-0.03, -0.93, 0.27).normalize(), UP = new THREE.Vector3(0, 1, 0);

/** site {p:[x,z], h, kit}, opts {detail: bell pads and sashes, gy(x,z)} -> {group, update(beat, dt), dispose(), n} */
export function createMorrisSide(site, opts = {}) {
  const K = KIT[site.kit] || KIT.sticks, group = new THREE.Group(); group.name = 'mayday:morris:' + site.kit;
  const cs = Math.cos(site.h), sn = Math.sin(site.h), gy = opts.gy || (() => 0.04);
  const geos = [], dancers = [], M = {};
  const own = (g) => { geos.push(g); return g; };
  const stickGeo = own((() => { const g = new THREE.CylinderGeometry(0.017, 0.02, 0.86, 6); const c = new THREE.Color(0xc8a868), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; })());
  const hankyGeo = own(merge([box(0.3, 0.3, 0.004, 0xfafaf6, 0, -0.17, 0, 0.78)]));
  const padGeo = own(merge([box(0.1, 0.13, 0.012, 0xd8b020, 0, -0.14, 0.062), box(0.02, 0.02, 0.02, 0xe8e0a0, -0.03, -0.11, 0.072), box(0.02, 0.02, 0.02, 0xe8e0a0, 0.03, -0.11, 0.072), box(0.02, 0.02, 0.02, 0xe8e0a0, 0, -0.17, 0.072)]));
  const sashGeo = own(merge([box(0.06, 0.62, 0.3, K.sash[0], 0, 0.27, 0, 0.62), box(0.06, 0.62, 0.3, K.sash[1], 0, 0.27, 0, -0.62), box(0.1, 0.1, 0.012, K.sash[1], 0, 0.27, 0.155)]));
  for (let i = 0; i < 7; i++) {
    const seed = 7700 + i * 13 + (site.kit === 'sticks' ? 0 : 500), mus = i === 6;
    const look = { ...randomLook(seed, { outfit: 'casual' }), figure: i % 3 === 1 ? 'f' : 'm', top: 0xf6f4ee, topStyle: 'shirt', sleeves: 'long', bottom: K.bottom, legs: K.legs, shoes: 0x141414, shoeStyle: 'shoe', height: 1.76, hat: K.hat, hatColor: K.hatColor, jacket: null, scarf: null, backpack: null, prop: null, skirt: null, dress: false, tights: K.legs === 'shorts' ? 0xf0eee6 : null };
    if (mus) { look.jacket = 0x2a3a2a; look.jacketLen = 'hip'; look.hat = 'flatcap'; look.hatColor = 0x3a3a30; look.bottom = 0x3a3026; look.legs = 'trousers'; look.tights = null; }
    const ch = createCharacter(look); ch.noLod = true; ch.lookAtPlayer = false; ch.setPose('stand'); ch.blend = 1;
    ch.group.userData.footfree = 'morris step-hop';       // the legs are set by the dance below (a hop on every half beat): tools/audit_footslide.mjs leaves them out
    const d = { ch, i, mus, extra: [] };
    const add = (parent, geo, fn) => { const m = new THREE.Mesh(geo, mat()); m.castShadow = false; if (fn) fn(m); parent.add(m); d.extra.push(m); return m; };
    if (mus) {
      // melodeon (sticks side) or fiddle (hankies side), held to the chest; the arms work it
      if (site.kit === 'sticks') add(ch.bones.torso, own(merge([box(0.13, 0.26, 0.15, 0x8a1c1c, -0.15, 0.24, 0.2), box(0.13, 0.26, 0.15, 0x8a1c1c, 0.15, 0.24, 0.2), box(0.17, 0.22, 0.12, 0x2a2622, 0, 0.24, 0.2), box(0.02, 0.2, 0.02, 0xe8e0d0, -0.2, 0.24, 0.28)])));
      else add(ch.bones.torso, own(merge([box(0.2, 0.05, 0.34, 0x8a4a1c, -0.2, 0.47, 0.2, 0.3), box(0.035, 0.03, 0.3, 0x2a1a10, -0.27, 0.46, 0.47, 0.3)])));
    } else {
      if (site.kit === 'sticks') d.stick = add(ch.anchors.handR, stickGeo, (m) => { m.quaternion.setFromUnitVectors(UP, STICK_DIR); m.position.copy(STICK_DIR).multiplyScalar(0.33); });
      else { add(ch.anchors.handR, hankyGeo); add(ch.anchors.handL, hankyGeo); }
      if (opts.detail !== false) { add(ch.bones.torso, sashGeo); add(ch.bones.shinL, padGeo); add(ch.bones.shinR, padGeo); }
    }
    group.add(ch.group); dancers.push(d);
  }
  const place = (d, x, z, h) => { const wx = site.p[0] + x * cs + z * sn, wz = site.p[1] - x * sn + z * cs; d.ch.group.position.set(wx, gy(wx, wz), wz); d.ch.group.rotation.y = site.h + h; };
  const sstep = (x) => x * x * (3 - 2 * x);
  return {
    group, n: dancers.length, site,
    /** beat: jig beats on the shared clock (float); dancing false = stand at ease in the set (before the music) */
    update(beat, dt, dancing = true) {
      const fb = beat - Math.floor(beat), ib = Math.floor(beat);
      for (const d of dancers) {
        const ch = d.ch, B = ch.bones;
        if (d.mus) {
          place(d, 0, 5.2, Math.PI);
          ch.update(dt, 0);
          const sq = dancing ? Math.sin(beat * Math.PI) : 0, tap = dancing ? Math.max(0, Math.sin(beat * Math.PI * 2)) : 0;
          if (site.kit === 'sticks') { B.armL.rotation.set(-0.55, 0, 0.32 + 0.14 * sq); B.foreL.rotation.set(-1.45, 0, 0); B.armR.rotation.set(-0.55, 0, -0.34 + 0.05 * sq); B.foreR.rotation.set(-1.45, 0, 0); }
          else { B.armL.rotation.set(-1.25, 0, 0.5); B.foreL.rotation.set(-1.9, 0, 0); B.armR.rotation.set(-0.9 - 0.25 * sq, 0, -0.3); B.foreR.rotation.set(-1.5 + 0.35 * sq, 0, 0); B.head.rotation.z += 0.22; }
          B.shinR.rotation.x += 0.0; B.thighR.rotation.x -= 0.1 * tap; B.shinR.rotation.x += 0.2 * tap; B.torso.rotation.z += 0.04 * sq;
          continue;
        }
        if (!dancing) { morrisAt(d.i, 0, M); place(d, M.x, M.z, d.i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2); ch.update(dt, 0); if (d.stick) { B.armR.rotation.set(-0.35, 0, -0.1); B.foreR.rotation.set(-1.9, 0, 0); } continue; }
        morrisAt(d.i, beat, M);
        place(d, M.x, M.z, M.h);
        ch.update(dt, 0);
        // step-hop: one step to the beat, a hop on the half beat; the free leg (alternating) is lifted in front
        const hop = Math.abs(Math.sin(fb * Math.PI * 2)), lift = Math.sin(Math.min(1, fb * 1.25) * Math.PI), leftFree = (ib + d.i) % 2 === 0;
        ch.group.position.y += 0.035 + 0.055 * hop;
        const tF = leftFree ? B.thighL : B.thighR, sF = leftFree ? B.shinL : B.shinR, tS = leftFree ? B.thighR : B.thighL, sS = leftFree ? B.shinR : B.shinL;
        tF.rotation.set(-(0.25 + 0.6 * lift), 0, 0); sF.rotation.x = 0.35 + 0.75 * lift;
        tS.rotation.set(0.06 * M.move, 0, 0); sS.rotation.x = 0.1 * (1 - hop);
        B.torso.rotation.x = 0.05 + 0.05 * M.move; B.head.rotation.x -= 0.05;
        const sw = Math.sin(beat * Math.PI);
        if (d.stick) {
          // carried upright in the right hand; thrown forward to meet the partner's (high, then low)
          const c = sstep(Math.min(1, M.clash)), F = 0.45 + c * ((M.high ? 1.75 : 1.02) - 0.45), E = 1.75 + c * ((M.high ? 0.5 : 0.7) - 1.75);
          B.armR.rotation.set(-F, 0, -0.12 + 0.2 * c); B.foreR.rotation.set(-E, 0, 0);
          B.armL.rotation.set(-0.25 * sw - 0.15, 0, 0.16); B.foreL.rotation.set(-0.5, 0, 0);
          if (c > 0.3) B.torso.rotation.y = 0.18 * c;
        } else {
          // handkerchiefs: flicked up overhead on the chorus beats, circled down and up while travelling
          const fig = M.fig === 1 || M.fig === 3, up = fig ? (M.u < 8 ? sstep(Math.min(1, M.clash)) : 0.5 + 0.5 * Math.sin(beat * Math.PI * 2)) : 0.5 + 0.5 * Math.sin(beat * Math.PI);
          const F = -0.35 + up * 2.85, E = 0.35 + 0.5 * (1 - up);
          B.armR.rotation.set(-F, 0, -0.22 - 0.2 * up); B.foreR.rotation.set(-E, 0, 0);
          B.armL.rotation.set(-F, 0, 0.22 + 0.2 * up); B.foreL.rotation.set(-E, 0, 0);
          for (const m of d.extra) if (m.geometry === hankyGeo) { m.rotation.x = -1.2 * up + 0.5 * Math.sin(beat * Math.PI * 4 + hash(d.i, 3) * 6); }
        }
      }
    },
    /** world position of the tip of dancer i's stick (tests: partners' sticks meet on the clash) */
    stickTip(i, out = new THREE.Vector3()) { const d = dancers[i]; if (!d || !d.stick) return null; d.ch.group.updateMatrixWorld(true); return out.set(0, 0.43, 0).applyMatrix4(d.stick.matrixWorld); },
    dancer: (i) => dancers[i],
    dispose() { for (const d of dancers) { for (const m of d.extra) m.removeFromParent(); try { d.ch.dispose(); } catch { /* */ } } for (const g of geos) g.dispose(); },
  };
}
