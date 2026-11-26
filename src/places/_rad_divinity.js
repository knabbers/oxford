// The Divinity School (1427-83) interior: one room, 26.4 x 9.4 m, five bays, five six-light Perpendicular windows a side,
// William Orchard's lierne vault (1480-83) with pendants, Wren's north door (1669), the 1660s platforms in the two west
// bays, stone flags, benches along the walls. Correct but plain; the vault is the point and is the showpiece for the
// visual pass.  build(ctx) -> { meshes, dims, spawn, exit }   ctx = interiors ctx + { world }
// Room frame: x along the room (east +), z across (south +), y up; the east end opens to the Proscholium (the way in).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RB, rectPts, tudorPts, buildBatch, packKeys, TAU, flatUp, frame, pack } from './_rad_kit.js';
import { geoOf } from './_rad_lod.js';
import { stoneWindows, stonePassage, stoneRoom } from './_wc_stone.js';
import { archLining } from './_walkin_city.js';

export const DIV = { L: 26.4, W: 9.4, wall: 7.8, crown: 11.5, bays: 5, lights: 6, pendantsPerBay: 2 };
// Walk-in (core/interiors.js "seamless"; plan in radcliffe_square.js): the School in place in its mapped building
// (w114320058: 10.8 x 24.1 m, so the room is 23.4 m long, not 26.4), reached as in life through the Proscholium — a
// plain stone vestibule (VEST: in the Schools quad's west range) between the quad door and the School's east doorway.
// Its five great windows a side are real openings (the middle north one is Wren's door, shut).
// Second pass: the mapped building is no longer drawn by the generic facades (it painted sash windows under the great
// windows): buildShell() below builds it by hand — ashlar, buttresses with pinnacles between the bays, battlements, and
// each great window a real four-centred opening with a stone reveal. The room's openings are the bounding rectangles of
// those arches, punched `punch` m out from the room's wall face (behind the shell's face, so the shell's arch frames
// them); the stone tracery is drawn in the world (radcliffe_square.js: dressOpenings), lit by the sun like the wall.
export const DIVS = { L: 23.4, sill: 3.1, spring: 6.5, top: 7.2, winW: 3.6, vest: { len: 8.53, wall: 0.6, hw: 2.6, h: 4.2 }, door: { w: 1.8, h: 3.05, rise: 0.45 }, depth: 0.7, punch: 0.4, shellH: 12.8, rec: 0.38, blindY: 5.0 };
export function divPlanSpec() {
  const hl = DIVS.L / 2, hw = DIV.W / 2, bay = DIVS.L / DIV.bays, V = DIVS.vest, xe = hl + V.wall + V.len, windows = [];
  for (const side of [-1, 1]) for (let k = 0; k < DIV.bays; k++) { if (side < 0 && k === 2) continue; windows.push({ at: [-hl + bay * (k + 0.5), side * hw], out: side < 0 ? Math.PI : 0, w: DIVS.winW, y0: DIVS.sill, y1: DIVS.top, depth: DIVS.depth, proud: DIVS.punch + 0.03 - DIVS.depth - 0.03, lights: DIV.lights }); }
  return { portal: { at: [xe, 0], out: Math.PI / 2, w: DIVS.door.w, h: DIVS.door.h }, wall: 0.5, rects: [[-hl, -hw, hl, hw], [hl, -V.hw, xe, V.hw]], center: [0, 0], mid: [hl - 4, 0], route: [[hl + V.wall + 3, 0]], windows };
}

let WIN = null;
/** a six-light cinquefoiled window with a transom, light through the glass: canvas, white-gold glass and lead lines */
function windowTexture() {
  if (WIN) return WIN;
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2620'; g.fillRect(0, 0, 256, 512);
  const n = DIV.lights, w = 256 / n;
  for (let i = 0; i < n; i++) {
    const x0 = i * w + 5, x1 = (i + 1) * w - 5;
    for (const [y0, y1] of [[40, 250], [262, 500]]) {
      const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#f6f2e2'); gr.addColorStop(1, '#e8dcb8');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0 + 14); g.quadraticCurveTo((x0 + x1) / 2, y0 - 10, x1, y0 + 14); g.lineTo(x1, y1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,40,40,0.55)'; g.lineWidth = 1.5;
      for (let y = y0 + 20; y < y1; y += 16) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x0 + (x1 - x0) * k / 3, y0 + 10); g.lineTo(x0 + (x1 - x0) * k / 3, y1); g.stroke(); }
    }
  }
  // the head: a four-centred arch, panel tracery above the lights
  g.fillStyle = '#2a2620'; g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0); g.lineTo(256, 30); g.quadraticCurveTo(128, -20, 0, 30); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  WIN = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: 0xd8d0bc });
  return WIN;
}

export function build(ctx) {
  const { world, scene, collider } = ctx, SL = !!(ctx.seamless && ctx.plan), D = SL ? { ...DIV, L: DIVS.L } : DIV;
  packKeys(world);
  const B = new RB(), hl = D.L / 2, hw = D.W / 2, bay = D.L / D.bays;
  // ---- floor (stone flags), end walls, side walls with window holes, buttress piers between the windows
  flatUp(B, 'pavingSolid', [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]], 0.0);
  const winW = 3.6, sill = 3.1, top = 7.2;
  for (const side of [-1, 1]) {
    // wall face from inside: a long face with five window holes
    const holes = []; for (let k = 0; k < D.bays; k++) { const cx = -hl + bay * (k + 0.5); holes.push(tudorPts(cx, winW, sill, top - 0.7, 0.7, 6)); }
    // Wren's door cuts into the middle north window (north = -z)
    const m = new THREE.Matrix4().makeRotationY(side < 0 ? 0 : Math.PI).setPosition(0, 0, side * hw);
    B.push(m);
    const outline = [[-hl, 0], [hl, 0], [hl, D.wall], [-hl, D.wall]].map(([x, y]) => [side < 0 ? x : -x, y]);
    B.face('stoneIn', side < 0 ? outline : outline.slice().reverse(), holes.map((h) => (side < 0 ? h : h.map(([x, y]) => [-x, y]))), 0, false);
    for (const h of holes) B.reveal('stoneIn', side < 0 ? h : h.map(([x, y]) => [-x, y]), 0, -0.7);
    // stone mullions and a transom in each window (the glass and its tracery are painted behind them)
    for (let k = 0; k < D.bays; k++) { const cx = -hl + bay * (k + 0.5), X = side < 0 ? cx : -cx;
      if (SL && !(side < 0 && k === 2)) continue;      // (walk-in: the mullions come with the real glazing — _wc_stone.js)
      for (let m = 1; m < D.lights; m++) B.box('stoneIn', X - winW / 2 + (winW * m) / D.lights, (sill + top) / 2, -0.45, 0.12, top - sill, 0.22, 0, { top: false });
      B.box('stoneIn', X, sill + (top - sill) * 0.52, -0.45, winW, 0.12, 0.22, 0, { bottom: true }); }
    // wall shafts between the bays, rising to the springing of the vault
    for (let k = 0; k <= D.bays; k++) { const x = -hl + bay * k; B.box('stoneDress', x, D.wall / 2, 0.15, 0.5, D.wall, 0.3); }
    // stone benches along the walls (low)
    B.box('stoneDress', 0, 0.22, 0.35, D.L - 0.2, 0.44, 0.7, 0, { top: true });
    B.pop();
  }
  // the windows: glass panes set back in the holes
  const glass = new THREE.Group();
  const winMat = windowTexture(), pane = new THREE.PlaneGeometry(winW, top - sill);
  for (const side of [-1, 1]) for (let k = 0; k < D.bays; k++) {
    if ((side < 0 && k === 2) || SL) continue;
    const m = new THREE.Mesh(pane, winMat); m.position.set(-hl + bay * (k + 0.5), (sill + top) / 2, side * (hw + 0.6)); m.rotation.y = side < 0 ? 0 : Math.PI; glass.add(m);
  }
  // Wren's door: an ogee-headed doorway in the middle north bay, under a shortened window
  {
    const x = -hl + bay * 2.5;
    const short = new THREE.Mesh(new THREE.PlaneGeometry(winW, top - 5.0), winMat); short.position.set(x, (5.0 + top) / 2, -hw - 0.6); glass.add(short);
    B.push(new THREE.Matrix4().setPosition(0, 0, -hw + 0.02));
    B.box('stoneDress', x, 2.4, 0, 3.6, 4.8, 0.6);                      // the infill under the window, with the door
    B.unit('archDoorOak', tudorPts(x, 1.8, 0, 2.6, 0.9, 8), 0.31, [0, 0]);
    B.cyl('stoneDress', x, 4.7, 0.3, 0.02, 1.4, 4, false, 0.18);       // the ogee's crocketed finial
    B.pop();
  }
  // end walls: east (the way in, an opening to the Proscholium) and west (towards Convocation House)
  for (const end of [-1, 1]) {
    const m = new THREE.Matrix4().makeRotationY(end > 0 ? -Math.PI / 2 : Math.PI / 2).setPosition(end * hl, 0, 0);
    B.push(m);
    const outline = SL ? [[-hw, 0], [hw, 0], [hw, D.crown + 0.3], [-hw, D.crown + 0.3]] : [[-hw, 0], [hw, 0], [hw, D.wall], [0, D.crown], [-hw, D.wall]];   // (walk-in: no gap beside the vault's curve)
    const holes = end > 0 ? [tudorPts(0, 2.4, 0, 2.8, 0.6, 8)] : [];
    B.face('stoneIn', outline, holes, 0, false);
    if (end > 0) { if (!SL) B.unit('dark', tudorPts(0, 2.4, 0, 2.8, 0.6, 8), -0.3, [0, 0]); }
    else B.unit('archDoorOak', tudorPts(0, 1.6, 0, 2.4, 0.5, 8), 0.03, [0, 0]);
    B.pop();
  }
  // ---- the vault (visual pass): a four-centred tunnel of warm stone webs; every bay crossed by a deep transverse arch from
  // which two pendants hang like lanterns (canopied niches with figures, a pointed drop below); from the pendants and the
  // wall springers tiercerons fan to an eight-pointed star of liernes round the bay's crown; a ridge rib; carved bosses at
  // every crossing (some gilded). G: the layout follows photographs of Orchard's vault, not a survey.
  const prof = (z) => { const t = Math.min(1, Math.abs(z) / hw); return D.wall + (D.crown - D.wall) * Math.sqrt(Math.max(0, 1 - t * t)) ** 0.85; };
  const dprof = (z) => (prof(z + 0.01) - prof(z - 0.01)) / 0.02;
  const NZ = 18;
  for (let j = 0; j < NZ; j++) {
    const z0 = -hw + (D.W * j) / NZ, z1 = -hw + (D.W * (j + 1)) / NZ, y0 = prof(z0), y1 = prof(z1);
    const n = (z) => { const d = dprof(z), l = Math.hypot(d, 1); return [0, -1 / l, d / l]; };
    B.quadN('stoneIn', [-hl, y0, z0], [hl, y0, z0], [hl, y1, z1], [-hl, y1, z1], n(z0), n(z0), n(z1), n(z1), [-hl, z0], [hl, z0], [hl, z1], [-hl, z1]);
  }
  const S = (x, z, o = 0) => [x, prof(z) - o, z];
  /** a moulded rib along the vault between two plan points (x, z), following its surface */
  const rib = (a, b, w = 0.13, d = 0.24, key = 'stoneDress', n = 6) => {
    const path = []; for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; path.push(S(x, z, 0.02)); }
    B.sweep(key, path, [[-w, 0], [-w * 0.8, d * 0.6], [-w * 0.3, d], [w * 0.3, d], [w * 0.8, d * 0.6], [w, 0]], [0, -1, 0]);
  };
  const boss = (x, z, r = 0.2, gold = false) => { const [X, Y, Z] = S(x, z, 0.2); B.lathe(gold ? 'gold' : 'stoneDress', X, Z, [[0, Y - 0.16], [r * 0.6, Y - 0.12], [r, Y - 0.02], [r * 0.9, Y + 0.1], [0, Y + 0.12]], { seg: 8, crease: 0.7 }); };
  const pendant = (x, z, k) => {
    const [X, Y, Z] = S(x, z, 0.3), yb = Y - 2.3;
    // the canopied lantern: an octagon that widens under the arch, niches with figures on its faces, a crocketed drop
    B.lathe('stoneDress', X, Z, [[0.2, Y + 0.2], [0.3, Y - 0.2], [0.55, Y - 0.55], [0.6, Y - 0.75], [0.48, Y - 0.8], [0.48, yb + 0.55], [0.6, yb + 0.5], [0.5, yb + 0.3], [0.3, yb], [0.12, yb - 0.35], [0, yb - 0.6]], { seg: 8, facet: true, crease: 0.5 });
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU, ca = Math.cos(a), sa = Math.sin(a), r = 0.485;
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(ca, 0, -sa), new THREE.Vector3(0, 1, 0), new THREE.Vector3(sa, 0, ca)).setPosition(X + sa * r, 0, Z + ca * r);
      B.push(M); B.unit('niche', [[-0.18, yb + 0.6], [0.18, yb + 0.6], [0.18, Y - 0.85], [-0.18, Y - 0.85]], 0.005, [0, 0]); B.pop(); }
    boss(x, z, 0.26, k % 2 === 0);
  };
  for (let k = 0; k <= D.bays; k++) {
    // the transverse arch: a deep rib right across, with a broad soffit
    const x = -hl + bay * k;
    { const path = []; for (let i = 0; i <= 16; i++) { const z = -hw + (D.W * i) / 16; path.push(S(x, z, 0.0)); }
      B.sweep('stoneDress', path, [[-0.28, 0], [-0.24, 0.3], [-0.12, 0.42], [0.12, 0.42], [0.24, 0.3], [0.28, 0]], [0, -1, 0]); }
    if (k > 0 && k < D.bays) for (const s of [-1, 1]) pendant(x, s * hw * 0.42, k);
  }
  for (let k = 0; k < D.bays; k++) {
    const x0 = -hl + bay * k, x1 = x0 + bay, xm = (x0 + x1) / 2, zp = hw * 0.42;
    // star of liernes round the crown (8 points), tiercerons from the pendants / springers to the star, bosses at crossings
    const star = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = i % 2 ? 1.25 : 2.0; star.push([xm + Math.cos(a) * r, Math.sin(a) * r * 0.8]); }
    for (let i = 0; i < 8; i++) rib(star[i], star[(i + 1) % 8], 0.1, 0.18);
    const corners = [[x0, -zp], [x1, -zp], [x0, zp], [x1, zp]];
    for (const [cx, cz] of corners) { // from each pendant (or the wall at the end bays) to the nearest two star points
      const near = star.map((p, i) => [Math.hypot(p[0] - cx, p[1] - cz), i]).sort((a, b) => a[0] - b[0]).slice(0, 2);
      for (const [, i] of near) rib([cx, cz], star[i], 0.11, 0.2);
    }
    for (const s of [-1, 1]) { rib([x0, s * hw], [x0 + bay * 0.25, s * zp], 0.11, 0.2); rib([x1, s * hw], [x1 - bay * 0.25, s * zp], 0.11, 0.2); rib([x0 + bay * 0.25, s * zp], [xm, s * 2.0 * 0.8], 0.1, 0.18); rib([x1 - bay * 0.25, s * zp], [xm, s * 2.0 * 0.8], 0.1, 0.18);
      rib([xm, s * hw], [xm, s * 2.0 * 0.8], 0.1, 0.18); boss(x0 + bay * 0.25, s * zp, 0.15); boss(x1 - bay * 0.25, s * zp, 0.15); }
    rib([x0, 0], [x1, 0], 0.1, 0.2);                                     // the ridge
    for (let i = 0; i < 8; i++) boss(star[i][0], star[i][1], i % 2 ? 0.14 : 0.18, i % 4 === 0);
    boss(xm, 0, 0.32, true);
  }
  // ---- the 1660s platforms (raised wooden floor) in the two west bays, a rail and a lectern
  B.box('oak', -hl + bay, 0.35, 0, bay * 2 - 0.4, 0.7, D.W - 1.8, 0, { top: true });
  B.box('oak', -hl + bay * 2 - 0.15, 0.95, 0, 0.1, 0.5, D.W - 1.8);
  B.box('oak', -hl + 1.6, 1.25, 0, 0.5, 1.1, 0.6);
  // a display case or two (exhibition use: generic open books, no real exhibits)
  for (const x of [1.5, 6.5]) { B.box('oak', x, 0.45, 0, 2.2, 0.9, 1.0); B.box('white', x, 0.93, 0, 1.9, 0.04, 0.75); }
  const meshes = buildBatch(B, world, scene, 'divinity', { noShadow: true });
  // the window glass as ONE mesh (was a mesh per window)
  { const geos = []; glass.traverse((m) => { if (m.isMesh) { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); geos.push(g.index ? g.toNonIndexed() : g); } });
    const gm = new THREE.Mesh(mergeGeometries(geos), winMat); gm.name = 'rad:divinity:glass'; gm.matrixAutoUpdate = false; gm.updateMatrix(); scene.add(gm); meshes.push(gm); }
  // ---- light: daylight through the windows, a warm fill under the vault
  const lights = [];
  { const l = new THREE.HemisphereLight(0xf2eee0, 0x6a5a48, 0.9); scene.add(l); lights.push([l, 0.9]); }
  for (const x of [-8, 0, 8]) { const l = new THREE.PointLight(0xffe2b8, 14, 18, 1.6); l.position.set(x, 6.2, 0); scene.add(l); lights.push([l, 14]); }
  if (SL) { const l = new THREE.PointLight(0xffe2b8, 9, 11, 1.6); l.position.set(hl + DIVS.vest.wall + DIVS.vest.len / 2, 3.4, 0); scene.add(l); lights.push([l, 9]); }
  scene.traverse((o) => { if (o.isLight && !lights.some((q) => q[0] === o)) lights.push([o, o.intensity]); });      // (and the two core/interiors.js gives every room)
  /** by the hour (seen through the great windows from outside): k = 1 lit / daylight … 0.06 shut up at night */
  let litK = -1;
  const setLight = (k) => { k = Math.max(0.06, Math.min(1, k)); if (Math.abs(k - litK) < 0.01) return; litK = k; for (const [l, i] of lights) l.intensity = i * k; };
  if (scene.background) scene.background.set(0x2a2620);
  // ---- collision: walls, the platforms' edge, cases
  if (SL) {
    // the real glazing (the world shows through the leaded lights), the Proscholium vestibule and its walls
    const S = ctx.plan.seamless, V = DIVS.vest, x0 = hl + V.wall, x1 = x0 + V.len;
    // (glass only: the stone mullions and tracery are the world's — one set, seen from both sides)
    scene.add(stoneWindows(S.openings, { kind: 'leaded', reveal: false, noBars: true, inset: 0.45 }));
    { const lin = archLining(null, [{ at: S.portals[0].at, out: S.portals[0].out, w: S.portals[0].w, y0: 0, y1: S.portals[0].h, depth: S.portals[0].depth, head: 'segment', rise: DIVS.door.rise }], { color: 0xbfb393 }); if (lin) scene.add(lin); }
    scene.add(proscholium(x0, x1, V));
    scene.add(stoneRoom({ x0, x1, z0: -V.hw, z1: V.hw, h: V.h, floor: false, holes: [{ wall: 'w', c: 0, w: 2.4, h: 3.2 }, { wall: 'e', c: 0, w: DIVS.door.w, h: DIVS.door.h }] }));
    scene.add(stonePassage({ at: [hl, 0], out: Math.PI / 2, w: 2.4, h: 3.2, depth: V.wall - 0.02 }));
    scene.add(stonePassage(S.portals[0]));
    if (collider) {
      collider.addSegment(-hl, -hw, hl, -hw); collider.addSegment(-hl, hw, hl, hw); collider.addSegment(-hl, -hw, -hl, hw);
      for (const s of [-1, 1]) { collider.addSegment(hl, s * hw, hl, s * 1.2); collider.addSegment(hl, s * 1.2, x0, s * 1.2); collider.addSegment(x0, s * 1.2, x0, s * V.hw); collider.addSegment(x0, s * V.hw, x1, s * V.hw); }
      collider.addSegment(x1, -V.hw, x1, V.hw);
      // (the Proscholium's admissions desk and the bench under the notice board: they used to be walked through)
      { const xm = (x0 + x1) / 2; collider.addBox(xm + 0.8, V.hw - 0.75, 2.3, 0.8); collider.addBox(xm - 0.6, -V.hw + 0.3, 1.9, 0.44); }
    }
  }
  if (collider) {
    if (!SL) collider.addPolygon([[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([x, z]) => [x, z]));
    collider.addPolygon([[-hl + 0.4, -hw + 0.7], [-hl + bay * 2 - 0.2, -hw + 0.7], [-hl + bay * 2 - 0.2, hw - 0.7], [-hl + 0.4, hw - 0.7]]);
    for (const x of [1.5, 6.5]) collider.addBox(x, 0, 2.3, 1.1);
    for (const s of [-1, 1]) collider.addPolyline([[-hl, s * (hw - 0.75)], [hl, s * (hw - 0.75)]], { low: true });
  }
  if (SL) return { meshes, setLight, dims: { ...D }, spawn: [hl + DIVS.vest.wall + DIVS.vest.len - 1.6, 0], heading: -Math.PI / 2, exit: [hl + DIVS.vest.wall + DIVS.vest.len - 0.6, 0] };
  return { meshes, dims: { ...DIV }, spawn: [hl - 1.8, 0], heading: -Math.PI / 2, exit: [hl - 0.6, 0] };
}

/** the Proscholium's furniture (walk-in): a skirting course, a mat inside the quad door, the admissions desk with its
 *  lamp and till, a notice board, a bench, a rope on two posts, two lanterns on the walls (plain; GUESS) — one draw */
function proscholium(x0, x1, V) {
  const geos = [], hw = V.hw;
  const box = (x, y, z, w, h, d, col) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); geos.push(g); };
  const L = x1 - x0, xm = (x0 + x1) / 2;
  // stone flags (the plain stone room's own floor is left out: this one is lit from above)
  box(xm - 0.31, -0.05, 0, L + 0.64, 0.1, 2 * hw, 0xcbbd9c);
  for (let k = 1; k < 6; k++) box(x0 + (L * k) / 6, 0.002, 0, 0.03, 0.004, 2 * hw, 0xa99d80);
  for (const z of [-0.9, 0.9]) box(xm, 0.002, z, L, 0.004, 0.03, 0xa99d80);
  for (const s of [-1, 1]) { box(xm, 0.11, s * (hw - 0.03), L, 0.22, 0.06, 0x9f9478); box(xm, 3.05, s * (hw - 0.04), L, 0.14, 0.08, 0xa89c7e); }     // skirting, a string course
  box(x1 - 1.3, 0.012, 0, 1.6, 0.02, 1.7, 0x4a3a2c);                                                    // the mat
  // the admissions desk (south side), with a brass lamp, a till and leaflets
  box(xm + 0.8, 0.5, hw - 0.75, 2.2, 1.0, 0.7, 0x5a3c22); box(xm + 0.8, 1.02, hw - 0.75, 2.3, 0.05, 0.8, 0x3e2a1a);
  box(xm + 1.5, 1.2, hw - 0.7, 0.05, 0.3, 0.05, 0x8a7a3a); box(xm + 1.5, 1.38, hw - 0.7, 0.24, 0.1, 0.16, 0x2f5a3a);
  box(xm + 0.5, 1.13, hw - 0.7, 0.34, 0.18, 0.3, 0x2a2a2c); box(xm + 0.05, 1.06, hw - 0.8, 0.3, 0.03, 0.22, 0xe9e2cf);
  // a notice board (north wall) and a bench under it
  box(xm - 0.6, 1.7, -hw + 0.04, 1.5, 1.0, 0.05, 0x3e2a1a); box(xm - 0.6, 1.7, -hw + 0.07, 1.36, 0.86, 0.02, 0x4f6a4a);
  for (const [dx, dy, w, h] of [[-0.4, 0.15, 0.3, 0.4], [0.05, 0.1, 0.36, 0.5], [0.45, 0.2, 0.26, 0.34], [-0.1, -0.25, 0.4, 0.22]]) box(xm - 0.6 + dx, 1.7 + dy, -hw + 0.085, w, h, 0.01, 0xece6d4);
  box(xm - 0.6, 0.44, -hw + 0.3, 1.9, 0.07, 0.42, 0x5a3c22); for (const dx of [-0.85, 0.85]) box(xm - 0.6 + dx, 0.21, -hw + 0.3, 0.07, 0.42, 0.38, 0x3e2a1a);
  // rope posts either side of the way into the School
  for (const s of [-1, 1]) { box(x0 + 0.9, 0.5, s * 1.55, 0.06, 1.0, 0.06, 0x8a7a3a); box(x0 + 0.9, 0.03, s * 1.55, 0.3, 0.06, 0.3, 0x8a7a3a); }
  // wall lanterns
  for (const s of [-1, 1]) for (const fx of [0.25, 0.75]) { box(x0 + L * fx, 2.5, s * (hw - 0.1), 0.2, 0.34, 0.16, 0x2a2420); box(x0 + L * fx, 2.5, s * (hw - 0.13), 0.14, 0.24, 0.14, 0xffe2a8); }
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ vertexColors: true, name: 'rad:divinity-proscholium' })); m.name = 'rad:divinity:proscholium'; m.matrixAutoUpdate = false;
  return m;
}

/**
 * The School's outside (the mapped building is skipped): ctx = { world, lod, map, plan, id } -> { tris } | null.
 * Built in the room's own coordinates (the plan's frame), so every great window is exactly the room's opening.
 * Known: five bays, great four-centred six-light windows between deep buttresses with pinnacles, a battlemented
 * parapet, Wren's door of 1669 under the middle north window. Guessed: every dimension not the room's own.
 */
export function buildShell(ctx) {
  const { world, lod, map, plan, id } = ctx, b = map.buildings.find((q) => q.id === id); if (!b || !plan || !lod) return null;
  const P = pack(world), H = DIVS.shellH, hl = DIVS.L / 2, bay = DIVS.L / DIV.bays, hw = DIV.W / 2, rec = DIVS.rec;
  let x0 = 1e9, x1 = -1e9, zN = 1e9, zS = -1e9;
  for (const p of b.poly) { const l = plan.toLocal(p[0], p[1]); x0 = Math.min(x0, l[0]); x1 = Math.max(x1, l[0]); zN = Math.min(zN, l[1]); zS = Math.max(zS, l[1]); }
  if (!(zN < -hw - 0.3 && zS > hw + 0.3)) return null;
  const o = plan.toWorld(0, 0), c = Math.cos(plan.rot), s = Math.sin(plan.rot);
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(c, 0, -s), new THREE.Vector3(0, 1, 0), new THREE.Vector3(s, 0, c)).setPosition(o[0], 0, o[1]);
  const cx = (x0 + x1) / 2, L = x1 - x0, cz = (zN + zS) / 2, Wd = zS - zN;
  const out = { tris: [] };
  const levels = [0, 1, 2].map((q) => {
    const B = new RB(); B.push(M);
    for (const side of [-1, 1]) {
      const sg = side < 0 ? -1 : 1;                                   // local x of the wall frame = sg * room x
      B.push(frame(cx, 0, side < 0 ? zN : zS, sg, 0));
      const X = (x) => sg * (x - cx);
      const wins = []; for (let k = 0; k < DIV.bays; k++) { const blind = side < 0 && k === 2, xc = X(-hl + bay * (k + 0.5)); wins.push({ xc, blind, pts: tudorPts(xc, DIVS.winW, blind ? DIVS.blindY : DIVS.sill, DIVS.spring, DIVS.top - DIVS.spring, 8) }); }
      if (q === 0) {
        B.face('radHoney', rectPts(-L / 2, 0, L / 2, H), wins.map((w) => w.pts), 0);
        // (painted leaded glass at the back of every reveal: the far look, and the blind bay's; the room's opening is punched 5-10 cm in front of it)
        for (const w of wins) { B.reveal('radPale', w.pts, 0, -rec); if (w.blind) B.unit('leaded', w.pts, -rec, [3, 1]); else B.face('glassDark', w.pts, [], -rec); }
      } else {
        B.poly('radHoney', [[-L / 2, 0, 0], [L / 2, 0, 0], [L / 2, H, 0], [-L / 2, H, 0]], [0, 0, 1], [[-L / 2, 0], [L / 2, 0], [L / 2, H], [-L / 2, H]]);
        for (const w of wins) B.unit('perp', w.pts, 0.04, [((w.xc * 3) | 0) & 63, 1]);
      }
      if (q < 2) {
        // Wren's door under the middle north window, a hood mould over every window, the sill string, plinth
        for (const w of wins) { if (w.blind) { B.unit('archDoorOak', tudorPts(w.xc, 1.8, 0, 2.6, 0.9, 8), 0.04, [0, 0]); if (q === 0) { for (const sx of [-1, 1]) B.box('radPale', w.xc + sx * 1.05, 1.4, 0.07, 0.22, 2.8, 0.14, 0, { top: true }); B.box('radPale', w.xc, 3.75, 0.09, 2.5, 0.16, 0.18, 0, { bottom: true, top: true }); } }
          if (q === 0) B.box('radPale', w.xc, DIVS.top + 0.16, 0.08, DIVS.winW + 0.5, 0.14, 0.16, 0, { bottom: true, top: true }); }
        B.box('radPale', 0, DIVS.sill - 0.22, 0.06, L + 0.1, 0.2, 0.14, 0, { top: true, bottom: true });
        B.box('radPale', 0, 0.3, 0.07, L + 0.14, 0.6, 0.16, 0, { top: true });
        // buttresses between the bays: two stages with weathered offsets, a pinnacle over the parapet
        for (let k = 0; k <= DIV.bays; k++) {
          const x = Math.max(-L / 2 + 0.4, Math.min(L / 2 - 0.4, X(-hl + bay * k))), bw = 0.8;
          B.box('radHoney', x, 3.7, 0.55, bw, 7.4, 1.1, 0, { top: false });
          B.poly('radPale', [[x - bw / 2, 7.4, 1.1], [x + bw / 2, 7.4, 1.1], [x + bw / 2, 8.0, 0.6], [x - bw / 2, 8.0, 0.6]], [0, 0.6, 1]);
          B.box('radHoney', x, 9.5, 0.3, bw - 0.06, 4.2, 0.6, 0, { top: false });
          B.poly('radPale', [[x - bw / 2, 11.6, 0.6], [x + bw / 2, 11.6, 0.6], [x + bw / 2, 12.2, 0], [x - bw / 2, 12.2, 0]], [0, 0.6, 1]);
          if (q === 0) { B.box('radPale', x, H + 1.0, -0.05, 0.5, 2.0, 0.5, 0, { top: false }); B.cyl('radPale', x, H + 2.0, -0.05, 0.02, 1.5, 4, false, 0.32); }
        }
        // the parapet: a moulded string, battlements
        B.box('radPale', 0, H - 0.5, 0.08, L + 0.16, 0.22, 0.16, 0, { top: true, bottom: true });
        const m = Math.max(1, Math.floor(L / 1.7));
        for (let k = 0; k < m; k++) B.box('radHoney', -L / 2 + (k + 0.5) * (L / m), H + 0.3, -0.15, (L / m) * 0.52, 0.6, 0.3, 0, { top: true });
      }
      B.pop();
    }
    // the ends (against the Schools' west range and Convocation House), the lead flat
    for (const e of [-1, 1]) { B.push(frame(e < 0 ? x0 : x1, 0, cz, 0, -e)); B.poly('radHoney', [[-Wd / 2, 0, 0], [Wd / 2, 0, 0], [Wd / 2, H, 0], [-Wd / 2, H, 0]], [0, 0, 1], [[-Wd / 2, 0], [Wd / 2, 0], [Wd / 2, H], [-Wd / 2, H]]); B.pop(); }
    flatUp(B, 'radLead', [[x0, zN], [x1, zN], [x1, zS], [x0, zS]], H - 0.05);
    B.pop();
    return B;
  });
  lod.cells('divinity', levels.map((B) => geoOf(B, P)), [70, 170, 1100]);
  return out;
}

/** the stone tracery of the great windows, as _walkin_city.js dressOpenings items (room coordinates): per window the
 *  dark far pane, five mullions, a transom, the springing rail, cusped (pointed) heads to each light in both tiers and
 *  the panel tracery's supermullions in the head. `ops` = the plan's openings; the blind bay over Wren's door too. */
export function traceryItems(ops, stone = 0xd6cbb0) {
  const out = [], n = DIV.lights, pr = DIVS.punch - DIVS.depth;
  const one = (at, o, y0, blind) => {
    const w = DIVS.winW, lw = w / n, tx = Math.cos(o), tz = -Math.sin(o), base = { out: o, depth: DIVS.depth, proud: pr, stone, wall: stone };
    const yt = DIVS.sill + (DIVS.top - DIVS.sill) * 0.52;
    out.push({ ...base, at, w, y0, y1: DIVS.top, mullions: n - 1, mullW: 0.13, transoms: blind ? [(DIVS.spring - y0) / (DIVS.top - y0)] : [(yt - y0) / (DIVS.top - y0), (DIVS.spring - y0) / (DIVS.top - y0)], fill: false });
    out.push({ ...base, at, w, y0: DIVS.spring, y1: DIVS.top, mullions: 2 * n - 1, mullW: 0.07, fill: false });
    for (let j = 0; j < n; j++) { const sj = -w / 2 + lw * (j + 0.5), a2 = [at[0] + tx * sj, at[1] + tz * sj];
      for (const top of blind ? [DIVS.spring] : [yt, DIVS.spring]) out.push({ ...base, at: a2, w: lw - 0.12, y0: top - 0.42, y1: top - 0.05, head: 'pointed', rise: 0.3, fill: false }); }
  };
  for (const o of ops) one(o.at, o.out, o.y0, false);
  one([0, -DIV.W / 2], Math.PI, DIVS.blindY, true);
  return out;
}
