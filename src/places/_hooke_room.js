// The Robert Hooke Building's banana room (owned by places/hooke_building.js): geometry in ROOM-LOCAL metres
// (x along the Parks Road face from the bay's centre, y up, z outwards: 0 = the façade, -D = the back wall), so the same
// builders make the room seen through the windows from the street (a group placed at the bay) and the room you walk
// into (an interior scene).
//   buildShell({interior})   the room: walls, floor, ceiling, strip lights, desks, chairs, board frame (vertex colours)
//   buildExterior()          the bay's stone front (plinth, piers, fascia, sills), bronze window frames, the street door
//   buildGlass()             the window panes (genuinely transparent)
//   boardQuads()             the whiteboard quad + the fascia lettering + the door plate (uv into the sign canvas)
//   makeSignTexture(THREE)   one canvas: the board picture (_hooke_board.js) on top, the lettering below
//   bakeStudents()           the seated students as ONE merged mesh (baked from real characters)
//   createProfessor()        the lecturer: an articulated character + marker; poseProfessor(P, st, dt) animates him
//   roomColliders()          desk / wall boxes in room-local metres
import * as THREE from 'three';
import { createCharacter, randomLook, bakeCharacterGeometry } from '../core/characters.js';
import { trimBelow, compact, decimateTo } from './_maths_crowd.js';
import { HOOKE, ROOM, STUDENTS } from './_hooke_logic.js';
import { paintBoard } from './_hooke_board.js';

const D = HOOKE.D, HW = HOOKE.W / 2, CEIL = HOOKE.CEIL, GROUND = HOOKE.GROUND;
const C = {
  stone: 0xd9cfb6, stoneDark: 0xb9ae94, bronze: 0x3a332b, door: 0x24211d, carpet: 0x46505c, wall: 0xd2cdc2, ceiling: 0xdedcd4,
  wood: 0xc6a97b, grey: 0x7c838b, metal: 0x9aa0a6, chair: 0x2d4b74, light: 0xffffff, alu: 0xc4c8cc, cork: 0xa77f4c, paper: 0xf4f1e6,
  laptop: 0x2a2c30, skirting: 0x5a5852, doorWood: 0x8a6a46,
};
// face shading baked into the vertex colours (the shell is unlit): +y, -y, +z, -z, +x, -x
const SHADE = [1.0, 0.82, 0.93, 0.86, 0.9, 0.88];

/** vertex-colour box accumulator (non-indexed triangles) */
class VC {
  constructor() { this.P = []; this.N = []; this.C = []; this.U = null; }
  /** axis-aligned box from (x0, y0, z0) to (x1, y1, z1) */
  box(x0, y0, z0, x1, y1, z1, hex, k = 1, shade = SHADE) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)).toNonIndexed();
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const col = new THREE.Color(hex), p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      const nx = n[i], ny = n[i + 1], nz = n[i + 2];
      const s = ny > 0.5 ? shade[0] : ny < -0.5 ? shade[1] : nz > 0.5 ? shade[2] : nz < -0.5 ? shade[3] : nx > 0.5 ? shade[4] : shade[5];
      this.P.push(p[i], p[i + 1], p[i + 2]); this.N.push(nx, ny, nz); this.C.push(col.r * s * k, col.g * s * k, col.b * s * k);
    }
    g.dispose();
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** the room itself (unlit: the strip lights' look is baked into the colours). interior: the lobby doorway is open */
export function buildShell({ interior = false } = {}) {
  const v = new VC(), Z0 = -0.38;      // the inner face of the façade
  // floor, ceiling, back wall
  v.box(-HW, 0, -D, HW, 0.02, Z0, C.carpet);
  v.box(-HW, CEIL, -D, HW, CEIL + 0.04, Z0, C.ceiling, 1, [0.9, 0.86, 0.9, 0.9, 0.9, 0.9]);
  v.box(-HW, 0, -D, HW, CEIL, -D + 0.08, C.wall);
  // side walls; the left one (towards the lobby, -x) has the doorway near the windows
  const dz0 = -1.75, dz1 = -0.6, dh = 2.2;
  v.box(HW - 0.08, 0, -D, HW, CEIL, Z0, C.wall);
  v.box(-HW, 0, -D, -HW + 0.08, CEIL, dz0, C.wall);
  v.box(-HW, 0, dz1, -HW + 0.08, CEIL, Z0, C.wall);
  v.box(-HW, dh, dz0, -HW + 0.08, CEIL, dz1, C.wall);
  v.box(-HW + 0.02, dh, dz0 - 0.08, -HW + 0.12, dh + 0.08, dz1 + 0.08, C.doorWood);
  if (!interior) v.box(-HW + 0.03, 0, dz0, -HW + 0.07, dh, dz1, C.doorWood, 0.9);      // the door is shut (seen from the street)
  // skirting
  v.box(-HW + 0.08, 0.02, -D + 0.08, HW - 0.08, 0.12, -D + 0.1, C.skirting);
  // the whiteboard's frame and marker tray (the board picture is its own quad, boardQuads)
  const B = ROOM.board, bz = -D + 0.08;
  v.box(B.x - B.w / 2 - 0.06, B.y + B.h / 2, bz, B.x + B.w / 2 + 0.06, B.y + B.h / 2 + 0.05, bz + 0.05, C.alu);
  v.box(B.x - B.w / 2 - 0.06, B.y - B.h / 2 - 0.05, bz, B.x + B.w / 2 + 0.06, B.y - B.h / 2, bz + 0.05, C.alu);
  v.box(B.x - B.w / 2 - 0.06, B.y - B.h / 2, bz, B.x - B.w / 2, B.y + B.h / 2, bz + 0.05, C.alu);
  v.box(B.x + B.w / 2, B.y - B.h / 2, bz, B.x + B.w / 2 + 0.06, B.y + B.h / 2, bz + 0.05, C.alu);
  v.box(B.x - B.w / 2 + 0.2, B.y - B.h / 2 - 0.08, bz, B.x + B.w / 2 - 0.2, B.y - B.h / 2 - 0.05, bz + 0.12, C.alu);
  for (const [x, c] of [[B.x - 1.2, 0x1a1a1a], [B.x - 1.05, 0x1a3aa0], [B.x - 0.9, 0xb02020]]) v.box(x, B.y - B.h / 2 - 0.05, bz + 0.04, x + 0.12, B.y - B.h / 2 - 0.03, bz + 0.065, c);
  // strip lights: three rows of recessed fittings
  for (const z of [-7.4, -4.9, -2.4]) for (const x of [-4.2, -0.6, 3.0]) {
    v.box(x - 0.66, CEIL - 0.05, z - 0.17, x + 0.66, CEIL, z + 0.17, C.alu, 0.95);
    v.box(x - 0.6, CEIL - 0.06, z - 0.12, x + 0.6, CEIL - 0.05, z + 0.12, C.light, 1.75, [1.75, 1.75, 1.75, 1.75, 1.75, 1.75].map((q) => q / 1.75));
  }
  // desks (rows facing the board) and chairs
  const blocks = [[ROOM.cols[0] - 0.62, ROOM.cols[2] + 0.62], [ROOM.cols[3] - 0.62, ROOM.cols[5] + 0.62]];
  for (const rz of ROOM.rows) {
    const dz = rz - 0.58;
    for (const [x0, x1] of blocks) {
      v.box(x0, 0.71, dz - 0.27, x1, 0.75, dz + 0.27, C.wood);
      v.box(x0 + 0.02, 0.28, dz - 0.27, x1 - 0.02, 0.71, dz - 0.25, C.grey);       // modesty panel (board side)
      for (const x of [x0 + 0.05, x1 - 0.09]) v.box(x, 0.02, dz - 0.25, x + 0.04, 0.71, dz + 0.22, C.metal);
    }
    for (const cx of ROOM.cols) {
      v.box(cx - 0.22, 0.42, rz - 0.2, cx + 0.22, 0.46, rz + 0.2, C.chair);
      v.box(cx - 0.21, 0.5, rz + 0.18, cx + 0.21, 0.88, rz + 0.22, C.chair);
      v.box(cx - 0.02, 0.02, rz - 0.02, cx + 0.02, 0.42, rz + 0.02, C.metal);
      v.box(cx - 0.2, 0.02, rz - 0.18, cx + 0.2, 0.04, rz + 0.18, C.metal, 0.8);
    }
  }
  // the lecturer's desk with a laptop, a pin board on the right-hand wall, a clock on the left
  v.box(4.3, 0.71, -7.75, 5.8, 0.75, -7.05, C.wood);
  v.box(4.32, 0.02, -7.73, 5.78, 0.71, -7.71, C.grey);
  for (const x of [4.33, 5.73]) v.box(x, 0.02, -7.7, x + 0.04, 0.71, -7.1, C.metal);
  v.box(4.75, 0.75, -7.6, 5.2, 0.77, -7.3, C.laptop);
  v.box(4.75, 0.77, -7.62, 5.2, 1.05, -7.6, C.laptop, 0.8);
  v.box(HW - 0.1, 1.05, -6.6, HW - 0.08, 2.05, -3.4, C.cork);
  for (const [z, y] of [[-6.2, 1.6], [-5.5, 1.3], [-4.9, 1.75], [-4.1, 1.45], [-3.8, 1.85]]) v.box(HW - 0.11, y, z, HW - 0.1, y + 0.3, z + 0.21, C.paper);
  v.box(-HW + 0.08, 2.45, -5.35, -HW + 0.1, 2.85, -4.95, C.paper);
  v.box(-HW + 0.1, 2.64, -5.16, -HW + 0.11, 2.79, -5.14, 0x111111);
  return v.geometry();
}

/** the bay's street front: stone plinth, piers, fascia and string course, sills; bronze window frames; the street door */
export function buildExterior({ door = true } = {}) {      // door: false = the doorway is a real opening (walk-in): no modelled leaves
  const v = new VC(), z0 = -0.38, zf = 0.06, S = [1, 0.62, 0.92, 0.8, 0.88, 0.86];
  const sill = ROOM.sill, head = ROOM.head, W = ROOM.windows;
  v.box(-HW, 0, z0, HW, sill, zf, C.stone, 1, S);
  v.box(-HW, 0, z0 + 0.1, HW, 0.16, zf + 0.04, C.stoneDark, 1, S);
  const piers = [[-HW, W[0][0]]];
  for (let i = 0; i < W.length - 1; i++) piers.push([W[i][1], W[i + 1][0]]);
  piers.push([W[W.length - 1][1], HW]);
  for (const [a, b] of piers) v.box(a, sill, z0, b, head, zf, C.stone, 1, S);
  v.box(-HW, head, z0, HW, GROUND + 0.08, zf + 0.02, C.stone, 1, S);
  v.box(-HW, head - 0.02, z0, HW, head + 0.09, zf + 0.09, C.stoneDark, 1, S);      // a band over the windows
  v.box(-HW, GROUND - 0.06, z0, HW, GROUND + 0.06, zf + 0.12, C.stoneDark, 1, S);   // string course under the first floor
  for (const [a, b] of W) {
    v.box(a - 0.06, sill - 0.05, z0, b + 0.06, sill + 0.02, zf + 0.1, C.stoneDark, 1, S);   // projecting sill
    const fz0 = -0.13, fz1 = -0.04, f = 0.07;
    v.box(a, sill, fz0, a + f, head, fz1, C.bronze, 1, S); v.box(b - f, sill, fz0, b, head, fz1, C.bronze, 1, S);
    v.box(a, sill, fz0, b, sill + f, fz1, C.bronze, 1, S); v.box(a, head - f, fz0, b, head, fz1, C.bronze, 1, S);
    v.box(a, 2.72, fz0, b, 2.78, fz1, C.bronze, 1, S);                                          // transom (fanlights above)
  }
  // the street door into the lobby, on the building's own wall just north of the bay
  const dx = HOOKE.doorS - HOOKE.Sc;           // room-local x of the door's centre
  v.box(dx - 1.05, 0, 0, dx - 0.8, 2.98, 0.18, C.stone, 1, S); v.box(dx + 0.8, 0, 0, dx + 1.05, 2.98, 0.18, C.stone, 1, S);
  v.box(dx - 1.05, 2.72, 0, dx + 1.05, 3.04, 0.2, C.stone, 1, S);
  if (door) {
    v.box(dx - 0.8, 0, 0.01, dx + 0.8, 2.72, 0.05, C.door, 1, S);
    v.box(dx - 0.02, 0.05, 0.05, dx + 0.02, 2.67, 0.06, C.bronze, 1, S);                         // the meeting of the two leaves
    for (const x of [dx - 0.12, dx + 0.08]) v.box(x, 1.0, 0.06, x + 0.04, 1.3, 0.1, 0xb8a46a, 1, S);   // brass pull handles
  }
  v.box(dx - 1.4, 3.04, 0, dx + 1.4, 3.18, 1.15, C.stoneDark, 1, S);                           // canopy
  v.box(dx - 1.25, 0, 0, dx + 1.25, 0.13, 0.7, C.stoneDark, 1, S);                             // step
  v.box(dx - 2.27, 1.4, 0, dx - 1.17, 1.8, 0.025, C.bronze, 1, S);                             // the plate's backing (on the pier between the door and the next window)
  return v.geometry();
}

/** window panes (and the door's glazing) */
export function buildGlass() {
  const g = [];
  for (const [a, b] of ROOM.windows) { const q = new THREE.PlaneGeometry(b - a, ROOM.head - ROOM.sill); q.translate((a + b) / 2, (ROOM.sill + ROOM.head) / 2, -0.085); g.push(q.toNonIndexed()); }
  return mergePlain(g);
}

/** the board, fascia lettering and door plate: quads with uvs into the sign canvas (board = top half; strips below) */
export const SIGN_UV = { board: [0, 0.5, 1, 1], fascia: [0, 0.375, 1, 0.5], plate: [0, 0.125, 1, 0.375] };
export function boardQuads() {
  const B = ROOM.board, dx = HOOKE.doorS - HOOKE.Sc;
  const quad = (cx, cy, z, w, h, uv) => { const q = new THREE.PlaneGeometry(w, h).toNonIndexed(), a = q.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1])); q.translate(cx, cy, z); return q; };
  return {
    board: mergePlain([quad(B.x, B.y, -D + 0.1, B.w, B.h, SIGN_UV.board)]),
    signs: mergePlain([quad(0, (ROOM.head + 0.09 + GROUND - 0.06) / 2, 0.081, 6.4, 0.8 * (GROUND - 0.06 - ROOM.head - 0.09) / 0.8, SIGN_UV.fascia), quad(dx - 1.72, 1.6, 0.03, 1.0, 0.3, SIGN_UV.plate)]),
  };
}

/** one canvas: the board picture (1024 × 512) and, below it, the fascia lettering and the door plate */
export function makeSignTexture() {
  const W = 1024, H = 1024;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const board = paintBoard(1024, 512);
  try { const img = g.createImageData(1024, 512); if (img && img.data && img.data.set) img.data.set(board); g.putImageData(img, 0, 0); } catch (e) { /* node */ }
  try {
    g.clearRect(0, 512, W, 128);
    // fascia: bronze capitals on the stone (transparent around the letters: the stone band shows through)
    g.fillStyle = '#4e3d2a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 72; g.font = `bold ${fs}px Georgia, "Times New Roman", serif`;
    const tw = g.measureText('ROBERT HOOKE BUILDING').width; if (tw > W - 60) { fs = Math.floor(fs * (W - 60) / tw); g.font = `bold ${fs}px Georgia, "Times New Roman", serif`; }
    g.fillText('ROBERT HOOKE BUILDING', W / 2, 512 + 66);
    // the plate: dark slate, a cream rule and two lines
    g.fillStyle = '#20262c'; g.fillRect(0, 640, W, 256);
    g.strokeStyle = '#d8ccaa'; g.lineWidth = 6; g.strokeRect(14, 654, W - 28, 228);
    g.fillStyle = '#efe6cc'; g.font = 'bold 84px Georgia, serif'; g.fillText('Robert Hooke Building', W / 2, 640 + 100, W - 80);
    g.font = '46px Georgia, serif'; g.fillText('Parks Road  ·  University of Oxford', W / 2, 640 + 190);
    g.clearRect(0, 896, W, 128);
  } catch (e) { /* node */ }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, board, canvas: cv };
}

/** a lit vertex-colour material that also glows with its own colour (the strip lights inside) */
export function glowMaterial(uGlow, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = uGlow;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * uGlow;');
  };
  m.customProgramCacheKey = () => 'hookeGlow';
  m.name = 'hooke:people';
  return m;
}

/** the seated students: ONE merged mesh in room-local metres (facing the board, -z) */
export function bakeStudents() {
  const P = [], N = [], Cc = [], I = [];
  let vo = 0, tris = 0;
  STUDENTS.forEach(([row, col], i) => {
    const look = randomLook('hooke-student-' + i, { outfit: 'casual' }); look.prop = null; delete look.backpack; delete look.hat;
    const g = bakeCharacterGeometry(look, i % 3 === 1 ? 'sit' : 'write', 16);
    const pos = g.attributes.position.array, nor = g.attributes.normal.array, col3 = g.attributes.color.array, idx = g.index.array;
    const cut = compact(pos, nor, col3, trimBelow(pos, idx, 0.38));       // the desks hide the lower legs
    const lv = cut.idx.length / 3 > 1400 ? decimateTo(cut.pos, cut.col, cut.idx, 1400, { y: 1.0, k: 0.55 }) : cut;      // (no clustering below that: it smears clothes)
    const x = ROOM.cols[col], z = ROOM.rows[row], nv = lv.pos.length / 3;
    const nrm = lv.nor || null;
    for (let v = 0; v < nv; v++) {
      P.push(x - lv.pos[v * 3], lv.pos[v * 3 + 1] + 0.02, z - lv.pos[v * 3 + 2]);       // turned by pi: they face -z
      if (nrm) N.push(-nrm[v * 3], nrm[v * 3 + 1], -nrm[v * 3 + 2]);
      Cc.push(lv.col[v * 3], lv.col[v * 3 + 1], lv.col[v * 3 + 2]);
    }
    for (let j = 0; j < lv.idx.length; j++) I.push(lv.idx[j] + vo);
    vo += nv; tris += lv.idx.length / 3;
    g.dispose();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  if (N.length === P.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); else geo.computeVertexNormals();
  geo.setIndex(I);
  geo.computeBoundingSphere();
  geo.userData.tris = tris;
  return geo;
}

// ------------------------------------------------------------------------------------------------ the lecturer
/** an invented, generic don: tweed jacket over a checked shirt, mustard tie, corduroys, wild grey hair, glasses */
export function profLook() {
  const L = randomLook('hooke-banana-don', { outfit: 'tweed' });
  return { ...L, outfit: 'tweed', skin: 0xf1c9a5, hair: 0xd8d8d0, hairStyle: 'grey-wild', glasses: true, beard: undefined, height: 1.78, build: 1.0,
    jacket: 0x7a6a4a, top: 0xe8e0d0, bottom: 0x6a4a2e, neck: 'tie', neckColor: 0xc8a032, shoes: 0x5a3a22, hat: undefined, scarf: undefined, skirt: undefined, prop: null };
}
export function createProfessor(material) {
  const ch = createCharacter(profLook());
  ch.noLod = true; ch.voiceAs = false; ch.lookAtPlayer = false;
  if (material && ch._skin) ch._skin.material = material;
  // a whiteboard marker in the right hand
  const mk = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.14, 6).translate(0, -0.02, 0), new THREE.MeshLambertMaterial({ color: 0x15151a }));
  mk.rotation.x = Math.PI / 2; mk.name = 'hooke:marker';
  ch.anchors.handR.add(mk);
  return { ch, marker: mk, yaw: 0, t: 0 };
}
const lerp = (a, b, t) => a + (b - a) * t;
/**
 * Pose the lecturer for the schedule state st (_hooke_logic.js profAt): stands beside the board facing the class; turns
 * towards the board and waves his right arm at it in big enthusiastic loops; turns back to the class between waves.
 * Called after nothing else: it runs ch.update (the 'stand' pose) and then sets the arms, torso and head on top.
 */
export function poseProfessor(P, st, dt) {
  const ch = P.ch, B = ch.bones;
  P.t += dt;
  ch.setPose('stand');
  ch.mouth = st.speaking ? 0.35 + 0.35 * Math.abs(Math.sin(P.t * 17)) * (st.u < 1.3 ? 1 : 0) : 0;
  ch.update(dt, 0);
  const tb = st.toBoard, w = st.wave, ph = st.ph, t = P.t;
  // body yaw: 0 = facing the class (and the street); turned a third of the way towards the board (on his right)
  P.yaw = lerp(0, -0.62, tb);
  ch.group.rotation.y = P.yaw;
  // talking to the class: easy two-handed gestures; at the board: the big looping wave of the right arm
  const n1 = Math.sin(t * 1.3) * 0.6 + Math.sin(t * 2.3 + 1) * 0.4, n2 = Math.sin(t * 1.7 + 2) * 0.6 + Math.sin(t * 0.9) * 0.4;
  const talkF = 0.45 + 0.3 * n1, talkE = 1.05 + 0.35 * n2, talkA = 0.22 + 0.1 * n2;
  const wF = 0.55 + 0.42 * Math.cos(ph), wA = 1.45 + 0.38 * Math.sin(ph), wE = 0.3 + 0.28 * Math.sin(ph + 1.2);
  const F = lerp(lerp(talkF, 0.35, tb), wF, w), A = lerp(lerp(talkA, 0.5, tb), wA, w), E = lerp(lerp(talkE, 0.6, tb), wE, w);
  B.armR.rotation.set(-F, 0, -A);
  B.foreR.rotation.set(-E, 0.3 * w, 0);
  // the other hand: gesturing while he talks, on the hip-ish while he waves
  const lF = lerp(0.3 + 0.25 * n2, 0.15, Math.max(tb, w)), lE = lerp(0.9 + 0.4 * n1, 1.35, Math.max(tb, w)), lA = lerp(0.18, 0.42, w);
  B.armL.rotation.set(-lF, 0, lA);
  B.foreL.rotation.set(-lE, 0, 0);
  // torso leans into the wave; the head looks at the board, then back at the class as he says it
  const look = st.speaking ? 1 - Math.min(1, Math.max(0, (st.u - 0.1) / 0.35)) * (1 - Math.min(1, Math.max(0, (st.u - 1.5) / 0.4))) : 1;
  B.torso.rotation.y += -0.18 * w * Math.sin(ph) - 0.1 * tb;
  B.torso.rotation.z += 0.06 * w * Math.sin(ph);
  B.torso.rotation.x += 0.05 * w;
  B.head.rotation.y = lerp(0.35 * Math.sin(t * 0.37), -0.75 * look + 0.45 * (1 - look), tb);
  B.head.rotation.x = -0.05 * w;
  ch.rig.position.y += 0.025 * w * Math.max(0, Math.sin(ph * 2));      // a little bounce of enthusiasm
}

/** desks and the lecturer's desk, room-local boxes [cx, cz, w, d]; walls too for the interior */
export function roomColliders(interior = false) {
  const out = [];
  const blocks = [[ROOM.cols[0] - 0.62, ROOM.cols[2] + 0.62], [ROOM.cols[3] - 0.62, ROOM.cols[5] + 0.62]];
  for (const rz of ROOM.rows) for (const [x0, x1] of blocks) out.push([(x0 + x1) / 2, rz - 0.31, x1 - x0, 1.1]);      // (each run of desks WITH its row of chairs: the chairs used to be walked through)
  out.push([5.05, -7.4, 1.5, 0.7]);
  if (interior) {
    out.push([0, -D + 0.04, HOOKE.W, 0.12], [HW - 0.04, -D / 2, 0.12, D]);
    out.push([-HW + 0.04, (-D + -1.75) / 2, 0.12, D - 1.75], [-HW + 0.04, (-0.6 + -0.2) / 2, 0.12, 0.4]);
    out.push([0, -0.2, HOOKE.W, 0.4]);
  }
  return out;
}

function mergePlain(list) {
  const P = [], N = [], U = [];
  for (const g of list) { P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); if (g.attributes.uv) U.push(...g.attributes.uv.array); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  if (U.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeBoundingSphere();
  return g;
}
