// The Radcliffe Camera's reading room, seen from the doorway only (readers only: with a card you may stand inside the
// door and look; a rope and a librarian's glare keep you there). Plain: the circular room inside 8 piers and arches
// (K: RCHME), radial desks, readers at work (baked, one draw), the dome over the centre.
//   build(ctx) -> { meshes, spawn, heading, exit }   room frame: centre at the origin, the door on the north (-z)
import * as THREE from 'three';
import { bakeCharacterGeometry, characterMaterial, randomLook } from '../core/characters.js';
import { Batch, RB, buildBatch, packKeys, archPts, rectPts, frame, TAU , flatUp } from './_rad_kit.js';
import { stoneWindows, stonePassage } from './_wc_stone.js';
import { archLining } from './_walkin_city.js';
import { outsideTint } from './_b6_exam.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const ROOM = { R: 13.2, wall: 10.5, piers: 8, pierR: 6.6, archTop: 8.4, domeTop: 19 };
// Walk-in (core/interiors.js "seamless"; plan: _rad_games.js): the room sits concentric inside the Camera's ground stage
// (outer face apothem 15.1 m: the walls are 1.9 m thick). Its eight windows are the eight arched, iron-grilled openings
// of the projecting bays (which the 24-sided room's window faces already line up with); the door is the north door,
// at the top of its steps (the floor is the plinth level, 0.62 m above the square). WIN / DOOR in room metres.
// (second pass: each opening is the bounding rectangle of the exterior's own round-headed arch, punched at the back of
// its modelled reveal — the shell's arch masks the corners — so the outside shows one window / one door per bay)
export const WIN = { w: 2.5, y0: 0.43, y1: 5.98, rise: 1.25, depth: 0.3 }, DOOR = { w: 1.6, h: 3.63, rise: 0.8 };

export function build(ctx) {
  const { world, scene, collider } = ctx, D = ROOM, SL = !!(ctx.seamless && ctx.plan);
  packKeys(world);
  const B = new RB();
  const at = (t, r) => [Math.sin(t) * r, Math.cos(t) * r];
  flatUp(B, 'pavingSolid', Array.from({ length: 24 }, (_, i) => at((i / 24) * TAU, D.R)), 0);
  for (let i = 0; i < 24; i++) {                       // the outer wall, inside face, with tall windows
    const t0 = (i / 24) * TAU, t1 = ((i + 1) / 24) * TAU, tm = (t0 + t1) / 2, a = at(t0, D.R), b = at(t1, D.R), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (SL && (i % 3 === 1 || i === 11 || i === 12)) {
      // a real opening in this face: a window (the projecting bays) or half of the doorway (the two faces at the north vertex)
      const ap = D.R * Math.cos(Math.PI / 24), [x, z] = at(tm, ap), hole = i % 3 === 1 ? archPts(0, WIN.w, WIN.y0, WIN.y1 - WIN.rise, 12) : i === 11 ? rectPts(-L / 2, 0, -L / 2 + DOOR.w / 2, DOOR.h) : rectPts(L / 2 - DOOR.w / 2, 0, L / 2, DOOR.h);
      B.push(frame(x, 0, z, -Math.cos(tm), Math.sin(tm))); B.face('plasterLit', rectPts(-L / 2, 0, L / 2, D.wall), [hole], 0); B.pop();
    } else
    B.poly('plasterLit', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], D.wall, b[1]], [a[0], D.wall, a[1]]], [-Math.sin(tm), 0, -Math.cos(tm)], [[0, 0], [L, 0], [L, D.wall], [0, D.wall]]);
    if (i % 3 === 1 && !SL) { const [x, z] = at(tm, D.R - 0.05); B.push(frame(x, 0, z, -Math.cos(tm), Math.sin(tm))); B.unit('archSash', archPts(0, 2.0, 2.4, 7.0, 8), 0.0, [301 + i, 0]); B.pop(); }
    B.poly('plasterLit', [[0, D.wall + 3, 0], [b[0], D.wall, b[1]], [a[0], D.wall, a[1]]], [0, -1, 0]);
  }
  // the 8 piers and their arches, the drum and dome over the centre
  for (let k = 0; k < D.piers; k++) {
    const t = (k + 0.5) / D.piers * TAU, [x, z] = at(t, D.pierR);
    B.box('stoneDress', x, D.archTop / 2, z, 1.3, D.archTop, 1.3, t);
    const t2 = (k + 1.5) / D.piers * TAU, [x2, z2] = at(t2, D.pierR);
    const path = []; for (let i = 0; i <= 10; i++) { const f = i / 10, mxp = x + (x2 - x) * f, mzp = z + (z2 - z) * f, sp = Math.hypot(x2 - x, z2 - z) / 2; path.push([mxp, D.archTop - 2.2 + Math.sin(f * Math.PI) * Math.min(2.2, sp * 0.8), mzp]); }
    B.sweep('stoneDress', path, [[-0.6, -0.4], [-0.6, 0.4], [0.6, 0.4], [0.6, -0.4]], [0, 1, 0]);
    B.beam('stoneDress', [x, D.archTop + 0.3, z], [x2, D.archTop + 0.3, z2], 1.0, 0.6);
  }
  // the drum over the arcade and Gibbs's coffered dome (smooth, its coffers converging on the oculus), an oculus ring
  { const B2 = B; const prof = [[D.pierR + 0.35, D.archTop + 0.6, 'stoneDress'], [D.pierR + 0.35, D.archTop + 1.2, 'stoneDress'], [D.pierR, D.archTop + 1.3], [D.pierR, 12.2], [D.pierR - 0.35, 12.35, 'stoneDress'], [D.pierR - 0.35, 12.6, 'stoneDress'], [D.pierR, 12.7]];
    for (let j = 1; j <= 10; j++) { const p = (j / 10) * Math.PI / 2 * 0.86; prof.push([D.pierR * Math.cos(p), 12.7 + (D.domeTop - 12.7) * Math.sin(p), 'panelPale']); }
    prof.push([0.9, D.domeTop + 0.1, 'white'], [0.0, D.domeTop + 0.6, 'white']);
    B2.lathe('plasterLit', 0, 0, prof, { inside: true, seg: 48, crease: 0.4 }); }
  // desks: a ring of long tables between the piers and the wall, and a ring round the centre
  const desks = [];
  for (let k = 0; k < 16; k++) {
    const t = (k / 16) * TAU; if (Math.abs(Math.atan2(Math.sin(t - Math.PI), Math.cos(t - Math.PI))) < 0.3) continue;   // keep the door clear
    const [x, z] = at(t, 10.0); B.box('oak', x, 0.74, z, 2.4, 0.06, 0.9, t + Math.PI / 2); B.box('oak', x, 0.37, z, 2.2, 0.72, 0.5, t + Math.PI / 2); desks.push([x, z, t]);
    B.box('white', x, 0.78, z, 0.5, 0.02, 0.35, t);
  }
  B.box('radBronze', 0, 0.85, -D.R + 3.05, 3.2, 0.04, 0.04);                     // the rope
  const meshes = buildBatch(B, world, scene, 'reading', { noShadow: true });
  // readers, baked and merged into one draw (same faces and clothes as everyone else)
  let readers = null;
  try {
    const geos = [];
    desks.forEach(([x, z, t], i) => {
      if (i % 3 === 2) return;
      const g = bakeCharacterGeometry(randomLook(9100 + i, { outfit: i % 3 ? 'casual' : 'tweed' }), 'sit');
      const m = new THREE.Matrix4().makeRotationY(t + Math.PI).setPosition(x + Math.sin(t) * 0.75, 0, z + Math.cos(t) * 0.75); g.applyMatrix4(m); geos.push(g);
    });
    if (geos.length) { const g = mergeGeometries(geos); for (const q of geos) q.dispose(); const m = new THREE.Mesh(g, characterMaterial); m.name = 'rad:reading:readers'; m.userData.live = true; scene.add(m); meshes.push(m); readers = m; }
  } catch (e) { console.warn('[radcliffe_square] readers', e); }
  if (SL) {
    const S = ctx.plan.seamless;
    // the embrasures: each declared opening is at the grille, near the outside; the room's wall face is `tun` m further in
    const apIn = D.R * Math.cos(Math.PI / 24), emb = S.openings.map((o) => { const tun = Math.hypot(o.at[0], o.at[1]) - apIn; return { ...o, at: [o.at[0] - Math.sin(o.out) * tun, o.at[1] - Math.cos(o.out) * tun], depth: o.depth + tun }; });
    scene.add(stoneWindows(emb, { kind: 'grille', inset: 0.9 }));
    scene.add(outsideTint(S.openings, { opacity: 0.4, inset: 0.2 }));      // (glass seen from the square: darker than the lamp-lit room by day)
    scene.add(stonePassage(S.portals[0], { back: 0.25 }));
    // the round heads, seen from inside: the soffit of each arch through the 2 m wall (and the wall above the door's arch)
    const lin = archLining(null, [...emb.map((o) => ({ at: o.at, out: o.out, w: o.w, y0: o.y0, y1: o.y1, depth: o.depth, head: 'round', rise: WIN.rise })),
      { at: S.portals[0].at, out: S.portals[0].out, w: S.portals[0].w, y0: 0, y1: S.portals[0].h, depth: S.portals[0].depth, head: 'round', rise: DOOR.rise }], { color: 0xbfb393 });
    if (lin) scene.add(lin);
    // just inside the door: a mat, a notice on a stand, the issue desk's lamp (GUESS: plain, cheap)
    B2box(scene, [[0, 0.012, -D.R + 1.2, 1.5, 0.02, 0.9, 0x4a3a2c], [-1.25, 0.6, -D.R + 2.5, 0.05, 1.2, 0.05, 0x2a2420], [-1.25, 1.35, -D.R + 2.5, 0.5, 0.36, 0.03, 0xe9e2cf], [-1.25, 1.35, -D.R + 2.52, 0.4, 0.05, 0.012, 0x7a1a14],
      [2.6, 0.5, -D.R + 3.5, 1.6, 1.0, 0.7, 0x5a3c22], [2.6, 1.02, -D.R + 3.5, 1.7, 0.04, 0.8, 0x3e2a1a], [3.1, 1.2, -D.R + 3.5, 0.06, 0.34, 0.06, 0x8a7a3a], [3.1, 1.4, -D.R + 3.5, 0.26, 0.12, 0.18, 0x2f5a3a]]);
  }
  const lights = [];
  { const l = new THREE.HemisphereLight(0xfff4e0, 0x8a7a64, 1.0); scene.add(l); lights.push([l, 1.0]); }
  for (const [x, z] of [[0, 0], [0, 8], [7, -5], [-7, -5]]) { const l = new THREE.PointLight(0xffe0b0, 10, 16, 1.6); l.position.set(x, 4, z); scene.add(l); lights.push([l, 10]); }
  scene.traverse((o) => { if (o.isLight && !lights.some((q) => q[0] === o)) lights.push([o, o.intensity]); });      // (and the two core/interiors.js gives every room)
  /** the room by the hour: open = lit and at work; shut = dark, nobody at the desks (seen through the windows) */
  let litK = -1;
  const setOpen = (open, lit = open) => { if (readers && readers.visible !== !!open) readers.visible = !!open; const k = lit ? 1 : 0.07; if (k === litK) return; litK = k; for (const [l, i] of lights) l.intensity = i * k; };
  // you stand inside the door: a little pen behind a rope
  const spawn = [0, -D.R + 1.4];
  if (collider) collider.addPolygon([[-1.6, -D.R + 0.2], [1.6, -D.R + 0.2], [1.6, -D.R + 3.0], [-1.6, -D.R + 3.0]]);
  return { meshes, spawn, heading: 0, exit: [0, -D.R + 0.7], setOpen };
}

/** a few plain coloured boxes [x, y (centre), z, w, h, d, colour] as one vertex-coloured mesh */
function B2box(scene, list) {
  const geos = [];
  for (const [x, y, z, w, h, d, col] of list) { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); geos.push(g); }
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true, name: 'rad:reading-bits' })); m.name = 'rad:reading:bits'; m.matrixAutoUpdate = false; scene.add(m); return m;
}
