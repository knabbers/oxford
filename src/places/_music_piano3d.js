// 3D pianos for the Faculty of Music: an upright, a practice-room grand and the Denis Arnold Hall Steinway (concert
// grand, lid up on the stick). 88 keys = two InstancedMeshes (white / black) whose instances tilt when pressed and
// take a colour when highlighted. Piano-local frame: keyboard along x (bass at −x), the player sits on the +z side
// facing −z; key tops at y = KEY_Y. Owned by places/music_faculty.js.
import * as THREE from 'three';
import { MBatch, mbox, canvasTex } from './_music_batch.js';
import { MIDI_LO, MIDI_HI, isBlack } from './_music_logic.js';

export const WW = 0.0235, KEY_Y = 0.74, KEY_BACK = -0.06, WHITE_D = 0.148, BLACK_D = 0.092;
const WIDTH = 52 * WW, HALF = WIDTH / 2;
const DOWN_W = 0.072, DOWN_B = 0.085;               // key dip (radians about the back of the key)

const whiteIndex = new Map(), keyX = new Map();
{ let w = 0; for (let m = MIDI_LO; m <= MIDI_HI; m++) { if (!isBlack(m)) { whiteIndex.set(m, w); keyX.set(m, (w + 0.5) * WW - HALF); w++; } else keyX.set(m, w * WW - HALF); } }
export const keyCentreX = (m) => keyX.get(m);

let shared = null;
function sharedMats() {
  if (shared) return shared;
  const fall = (text, col) => canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#060607'; g.fillRect(0, 0, w, h); if (text) { g.fillStyle = col; g.font = 'bold 30px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); } });
  const strings = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6b4a22'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = 6 + i * 2.75; g.strokeStyle = i < 22 ? '#b07a3a' : '#cfd3d8'; g.lineWidth = i < 22 ? 1.6 : 0.8; g.beginPath(); g.moveTo(x, 0); g.lineTo(x * 0.85 + 20, h); g.stroke(); }
  });
  shared = {
    ebony: new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.22, metalness: 0.15, side: THREE.DoubleSide }),
    mahogany: new THREE.MeshStandardMaterial({ color: 0x4a2216, roughness: 0.35, metalness: 0.05 }),
    keys: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.3, metalness: 0.85 }),
    plate: new THREE.MeshStandardMaterial({ color: 0xb4903c, roughness: 0.45, metalness: 0.6 }),
    felt: new THREE.MeshStandardMaterial({ color: 0x7a1220, roughness: 0.95 }),
    strings: new THREE.MeshStandardMaterial({ map: strings, roughness: 0.5, metalness: 0.4 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.7 }),
    fallSteinway: new THREE.MeshStandardMaterial({ map: fall('STEINWAY & SONS', '#d8b45a'), roughness: 0.25 }),
    fallPlain: new THREE.MeshStandardMaterial({ map: fall('', ''), roughness: 0.25 }),
  };
  return shared;
}

const WHITE = new THREE.Color(0xf4efe2), BLACK = new THREE.Color(0x121214);
const PRESS_W = new THREE.Color(0xd8d2c2), PRESS_B = new THREE.Color(0x2a2a30);

/**
 * kind: 'upright' | 'grand' | 'steinway' | 'stage' (an electric stage piano on an X-stand). Returns
 * { group, kind, press(midi, down), mark(midi, hexColor|null), clearMarks(), pick(raycaster) -> {midi, front 0..1} | null,
 *   seat: [x, z] local stool position, cam: {pos:[x,y,z], look:[x,y,z]} local, update(dt) }
 */
export function createPiano(kind) {
  const M = sharedMats(), group = new THREE.Group(); group.name = 'piano:' + kind;
  const B = new MBatch(), wood = kind === 'upright' ? 'mahogany' : 'ebony';
  const cheekX = HALF + 0.035;
  // --- keyboard surround: key bed, cheeks, key slip (felt strip), fallboard folded back
  B.span(wood, -cheekX - 0.04, cheekX + 0.04, KEY_Y - 0.09, KEY_Y - 0.035, KEY_BACK - 0.02, KEY_BACK + WHITE_D + 0.012);   // key bed / bottom
  B.span(wood, -cheekX - 0.04, cheekX + 0.04, KEY_Y - 0.075, KEY_Y - 0.005, KEY_BACK + WHITE_D + 0.005, KEY_BACK + WHITE_D + 0.025); // key slip
  B.span('felt', -HALF, HALF, KEY_Y - 0.004, KEY_Y + 0.004, KEY_BACK - 0.012, KEY_BACK - 0.004);
  for (const s of [-1, 1]) B.span(wood, s * HALF + (s > 0 ? 0 : -0.07), s * HALF + (s > 0 ? 0.07 : 0), KEY_Y - 0.09, KEY_Y + 0.045, KEY_BACK - 0.03, KEY_BACK + WHITE_D + 0.025); // cheek blocks
  B.span(wood, -cheekX, cheekX, KEY_Y + 0.0, KEY_Y + 0.07, KEY_BACK - 0.09, KEY_BACK - 0.012);                      // fallboard rail behind the keys
  B.add(kind === 'steinway' ? 'fallSteinway' : 'fallPlain', new THREE.PlaneGeometry(0.5, 0.0625), 0, KEY_Y + 0.04, KEY_BACK - 0.0115, 0);
  let seat, cam;
  if (kind === 'upright') {
    const D0 = KEY_BACK - 0.09, D1 = -0.62, H = 1.27;
    B.span(wood, -cheekX - 0.04, cheekX + 0.04, 0.0, H, D1, D0 - 0.0);              // main case (back + sides as one box)
    B.span(wood, -cheekX - 0.06, cheekX + 0.06, H, H + 0.03, D1 - 0.01, D0 + 0.03);  // top lid
    B.span(wood, -cheekX, cheekX, KEY_Y + 0.07, KEY_Y + 0.12, D0 - 0.02, D0 + 0.05);  // folded fallboard
    B.span(wood, -0.42, 0.42, KEY_Y + 0.17, KEY_Y + 0.36, D0 + 0.005, D0 + 0.03);     // music desk board
    B.span(wood, -0.44, 0.44, KEY_Y + 0.16, KEY_Y + 0.18, D0 + 0.005, D0 + 0.06);     // desk ledge
    for (const s of [-1, 1]) { B.span(wood, s * (cheekX - 0.02) - 0.035, s * (cheekX - 0.02) + 0.035, 0, KEY_Y - 0.09, KEY_BACK + 0.02, KEY_BACK + 0.09); B.span(wood, s * (cheekX - 0.02) - 0.05, s * (cheekX - 0.02) + 0.05, 0, 0.05, KEY_BACK - 0.05, KEY_BACK + 0.16); }
    B.span(wood, -cheekX, cheekX, 0.05, 0.6, D0 - 0.02, D0 + 0.01);                    // bottom board
    for (const px of [-0.08, 0.08]) B.span('brass', px - 0.022, px + 0.022, 0.07, 0.085, D0 + 0.01, D0 + 0.13);
    seat = [0, 0.62]; cam = { pos: [0, 1.36, 0.5], look: [0, KEY_Y, KEY_BACK + 0.02] };
  } else if (kind === 'stage') {
    // an 88-key stage piano (a student's room: places/worcester_beaumont.js): a slab case behind the keys with a strip of
    // controls, on a folding X-stand. No maker's name anywhere.
    const D0 = KEY_BACK - 0.09, D1 = D0 - 0.15, top = KEY_Y + 0.05, bed = KEY_Y - 0.1;
    B.span(wood, -cheekX - 0.04, cheekX + 0.04, bed, top, D1, D0);
    for (const px of [-0.52, -0.45, -0.38, 0.3, 0.37, 0.44]) B.span('keys', px - 0.012, px + 0.012, top, top + 0.008, D0 - 0.09, D0 - 0.066);
    B.span('felt', -0.07, 0.07, top, top + 0.004, D0 - 0.1, D0 - 0.05);
    const zs = [D1 + 0.04, KEY_BACK + WHITE_D - 0.03], L = Math.hypot(0.86, bed - 0.03), a = Math.atan2(bed - 0.03, 0.86);
    for (const z of zs) for (const sg of [-1, 1]) B.add(wood, mbox(L, 0.03, 0.03), 0, bed / 2 + 0.01, z + sg * 0.012, [0, 0, sg * a]);
    for (const x of [-0.43, 0.43]) { B.span(wood, x - 0.018, x + 0.018, 0, 0.035, zs[0] - 0.06, zs[1] + 0.06); B.span(wood, x - 0.018, x + 0.018, bed - 0.03, bed, zs[0] - 0.03, zs[1] + 0.03); }
    seat = [0, 0.62]; cam = { pos: [0, 1.36, 0.5], look: [0, KEY_Y, KEY_BACK + 0.02] };
  } else {
    const L = kind === 'steinway' ? 2.74 : 1.62, RIM0 = 0.6, RIM1 = 0.98, front = KEY_BACK - 0.09;
    const sh = new THREE.Shape(), xr = cheekX + 0.04, xl = -cheekX - 0.04;
    sh.moveTo(xl, 0); sh.lineTo(xr, 0); sh.lineTo(xr, 0.42);
    sh.bezierCurveTo(xr, 0.42 + L * 0.3, 0.12, L * 0.45, 0.02, L * 0.78);
    sh.quadraticCurveTo(-0.08, L, -0.42, L); sh.quadraticCurveTo(xl, L, xl, L - 0.32); sh.lineTo(xl, 0);
    const pts = sh.getPoints(18);
    const inner = new THREE.Path(pts.map((p) => { const c = new THREE.Vector2(-0.1, L * 0.45); return p.clone().sub(c).multiplyScalar(0.93).add(c); }).reverse());
    const rimShape = new THREE.Shape(pts); rimShape.holes.push(inner);
    const toWorld = (geo, y) => { geo.rotateX(-Math.PI / 2); geo.translate(0, y, front); return geo; };   // shape y -> -z, extrusion -> +y
    // rim walls (hollow) + soundboard/strings + iron plate
    B.add(wood, toWorld(new THREE.ExtrudeGeometry(rimShape, { depth: RIM1 - RIM0, bevelEnabled: false, curveSegments: 18 }), RIM0), 0, 0, 0);
    const flatS = (s, y, key) => { const g = new THREE.ShapeGeometry(s, 18); g.rotateX(-Math.PI / 2); g.translate(0, y, front); const uv = g.attributes.uv; const p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 0.8) / 1.6, (-(p.getZ(i) - front)) / L); B.add(key, g); };
    flatS(new THREE.Shape(inner.getPoints()), RIM0 + 0.17, 'strings');
    flatS(new THREE.Shape(pts), RIM0 - 0.001, wood);              // underside
    // plate struts (gold) over the strings
    for (const [x0, z0, x1, z1] of [[-0.5, 0.15, -0.35, L * 0.85], [0.1, 0.15, -0.05, L * 0.7], [0.55, 0.2, 0.3, L * 0.42]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
      B.add('plate', mbox(0.05, 0.03, len), (x0 + x1) / 2, RIM0 + 0.2, front - (z0 + z1) / 2, -a + Math.PI);
    }
    B.span('plate', -cheekX + 0.03, cheekX - 0.03, RIM0 + 0.17, RIM0 + 0.23, front - 0.2, front - 0.06);
    // lid: steinway full stick, practice grand short stick; music desk
    const lidG = toWorld(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.022, bevelEnabled: false, curveSegments: 18 }), 0);
    const lid = new THREE.Mesh(lidG, M[wood]); lid.castShadow = true;
    const pivot = new THREE.Group(); pivot.position.set(xl, RIM1, 0); lid.position.set(-xl, 0, 0); pivot.add(lid);
    pivot.rotation.z = kind === 'steinway' ? 0.62 : 0.3; group.add(pivot);
    const stickL = kind === 'steinway' ? 1.0 : 0.5;
    B.add(wood, mbox(0.025, stickL, 0.025), xr - 0.12, RIM1 + stickL / 2 * Math.cos(0.12), front - L * 0.45, [0, 0, 0.12]);
    B.span(wood, -0.4, 0.4, RIM1 + 0.02, RIM1 + 0.25, front - 0.14, front - 0.12);   // music desk
    B.span(wood, -0.42, 0.42, RIM1 + 0.01, RIM1 + 0.03, front - 0.15, front - 0.08);
    // legs + lyre + pedals
    const leg = (x, zz) => { B.add(wood, new THREE.CylinderGeometry(0.06, 0.045, RIM0, 10), x, RIM0 / 2, front - zz); B.add('brass', new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), x, 0.025, front - zz); };
    leg(xl + 0.1, 0.18); leg(xr - 0.1, 0.18); leg(-0.2, L * 0.86);
    B.span(wood, -0.16, 0.16, 0.06, RIM0, front - 0.32, front - 0.28);
    for (const px of [-0.07, 0, 0.07]) B.span('brass', px - 0.018, px + 0.018, 0.07, 0.085, front - 0.3, front - 0.16);
    seat = [0, 0.62]; cam = { pos: [0, 1.38, 0.52], look: [0, KEY_Y, KEY_BACK + 0.02] };
  }
  const body = B.build(M, { shadows: true, name: 'piano-body' });
  group.add(body);

  // --- keys
  const wGeo = mbox(WW - 0.0012, 0.022, WHITE_D).translate(0, -0.011, WHITE_D / 2);
  const bGeo = mbox(0.0125, 0.024, BLACK_D).translate(0, 0.002, BLACK_D / 2);
  const whites = [], blacks = [];
  for (let m = MIDI_LO; m <= MIDI_HI; m++) (isBlack(m) ? blacks : whites).push(m);
  const wIM = new THREE.InstancedMesh(wGeo, M.keys, whites.length), bIM = new THREE.InstancedMesh(bGeo, M.keys, blacks.length);
  wIM.name = 'keys-white'; bIM.name = 'keys-black'; wIM.castShadow = false; wIM.receiveShadow = true;
  const slot = new Map();   // midi -> {im, i, base, down, mark, angle}
  const m4 = new THREE.Matrix4(), rx = new THREE.Matrix4();
  whites.forEach((m, i) => slot.set(m, { im: wIM, i, black: false, x: keyX.get(m), down: false, angle: 0, target: 0, mark: null }));
  blacks.forEach((m, i) => slot.set(m, { im: bIM, i, black: true, x: keyX.get(m), down: false, angle: 0, target: 0, mark: null }));
  const col = new THREE.Color();
  const place = (s) => { m4.makeTranslation(s.x, KEY_Y + (s.black ? 0.0 : 0), KEY_BACK); rx.makeRotationX(s.angle); m4.multiply(rx); s.im.setMatrixAt(s.i, m4); s.im.instanceMatrix.needsUpdate = true; };
  const paint = (s) => {
    if (s.mark !== null) col.setHex(s.mark).lerp(s.black ? BLACK : WHITE, s.down ? 0.15 : s.black ? 0.25 : 0.45);
    else col.copy(s.down ? (s.black ? PRESS_B : PRESS_W) : (s.black ? BLACK : WHITE));
    s.im.setColorAt(s.i, col); s.im.instanceColor.needsUpdate = true;
  };
  for (const s of slot.values()) { place(s); paint(s); }
  group.add(wIM, bIM);
  const moving = new Set();

  return {
    group, kind, seat, cam, slot,
    press(midi, down) { const s = slot.get(midi); if (!s || s.down === down) return; s.down = down; s.target = down ? (s.black ? DOWN_B : DOWN_W) : 0; moving.add(s); paint(s); },
    mark(midi, hex) { const s = slot.get(midi); if (!s || s.mark === hex) return; s.mark = hex; paint(s); },
    clearMarks() { for (const s of slot.values()) if (s.mark !== null) { s.mark = null; paint(s); } },
    releaseAll() { for (const [m, s] of slot) if (s.down) this.press(m, false); },
    /** raycast against the keys -> {midi, front: 0 (back) .. 1 (front edge)} */
    pick(ray) {
      const hits = ray.intersectObjects([bIM, wIM], false);
      if (!hits.length) return null;
      const h = hits[0], list = h.object === bIM ? blacks : whites, midi = list[h.instanceId];
      const lp = group.worldToLocal(h.point.clone());
      return { midi, front: Math.max(0, Math.min(1, (lp.z - KEY_BACK) / (h.object === bIM ? BLACK_D : WHITE_D))) };
    },
    /** animate key travel (fast down, springy up) */
    update(dt) {
      if (!moving.size) return;
      for (const s of moving) {
        const k = s.target > s.angle ? 60 : 28;
        s.angle += (s.target - s.angle) * Math.min(1, dt * k);
        if (Math.abs(s.target - s.angle) < 0.0008) { s.angle = s.target; moving.delete(s); }
        place(s);
      }
    },
  };
}

/** adjustable piano stool (upholstered top), origin on the floor, facing +z */
export function addStool(B, x, z, rot = 0, w = 0.62, y = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), P = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  const [cx, cz] = P(0, 0);
  B.add('stoolTop', mbox(w, 0.07, 0.34), cx, y + 0.5, cz, rot);
  B.add('stoolWood', mbox(w - 0.04, 0.08, 0.3), cx, y + 0.43, cz, rot);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [lx, lz] = P(sx * (w / 2 - 0.06), sz * 0.11); B.add('stoolWood', mbox(0.045, 0.4, 0.045), lx, y + 0.2, lz, rot); }
  for (const sx of [-1, 1]) { const [kx, kz] = P(sx * (w / 2 + 0.01), 0); B.add('brass', new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10).rotateZ(Math.PI / 2), kx, y + 0.43, kz, rot); }
}
