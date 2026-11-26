// Faculty of Music interior (St Aldate's, c. 2013): entrance lobby with the porters' hatch and pigeonholes, the Bate
// Collection room, the practice-room corridor (rooms 1–8, two of them open: 3 with an upright, 6 with a grand) and
// Denis Arnold Hall with the Steinway on a low stage. Layout is a plausible plan, not a survey (see the report).
// Static geometry is merged per material; colliders follow the walls drawn. Owned by places/music_faculty.js.
import * as THREE from 'three';
import { MBatch, mbox, canvasTex } from './_music_batch.js';
import { createPiano, addStool } from './_music_piano3d.js';
import { SEAMLESS } from '../core/interiors.js';

// FIT: the plan re-drawn to stand inside the real building (music_faculty.js RANGES: the entrance range is 8.4 m deep
// and ends at the east arm; the rear block's west face is 1.1 m behind the entrance front), so that the Faculty is a
// walk-in building (core/interiors.js "seamless"). What changed from the free plan (kept for ?seamless=0):
//   Denis Arnold Hall   14 × 12 × 6.4 m  ->  10.5 × 8 × 4.5 m (inside the entrance range and the east arm, under their
//                       eaves: the gabled roofs are 4.8 m at the walls), four rows of chairs
//                       instead of six, the stage 3.3 m deep at the east end; no side windows (both long walls are
//                       inside the building) — one tall window in the east wall, onto the court behind;
//   Bate Collection     its west wall 1 m further in (x 1..8), no street door of its own (the real Bate door is at the
//                       far north-west corner of the building, 25 m from this room: GUESS / not modelled as an entrance);
//   windows             real openings: two in the lobby's street front, two in the Bate's west wall, one in the hall.
export const FIT = SEAMLESS;

// ------------------------------------------------------------------------------------------- layout (interior metres)
export const L = {
  lobby: { x0: 0, x1: 8, z0: -3, z1: 3, h: 3.2 },
  lodge: { x0: 4.2, x1: 8, z0: -6, z1: -3 },
  bate: { x0: FIT ? 1 : 0, x1: 8, z0: 3, z1: 9, h: 3.0 },
  corr: { x0: 8, x1: 20, z0: -1, z1: 1, h: 3.0 },
  hall: FIT ? { x0: 20, x1: 30.5, z0: -4, z1: 4, h: 4.5 } : { x0: 20, x1: 34, z0: -6, z1: 6, h: 6.4 },
  stage: FIT ? { x0: 27.2, x1: 30.5, z0: -3.4, z1: 3.4, y: 0.35 } : { x0: 29.6, x1: 34, z0: -4.6, z1: 4.6, y: 0.35 },
  steinway: FIT ? [28.9, -1.2] : [31.6, -1.6], chairRows: FIT ? 4 : 6,
  // the street doorway (lobby west wall) and, in the fitted plan, the real windows: { at, out, w, y0, y1 } on wall centre lines
  door: { z: 0, w: FIT ? 1.5 : 1.4, h: FIT ? 2.5 : 2.4 },
  windows: FIT ? [
    // (second pass: each one is THE window of its bay outside — music_faculty.js dresses them: the entrance front's two
    // stone-mullioned lights, the Bate's two sashes on the rear block's bays, the hall's two-light window on the east arm's bay)
    { at: [0, -2.15], out: -Math.PI / 2, w: 1.3, y0: 0.95, y1: 2.35 }, { at: [0, 2.15], out: -Math.PI / 2, w: 1.3, y0: 0.95, y1: 2.35 },
    { at: [1, 5.73], out: -Math.PI / 2, w: 1.1, y0: 0.76, y1: 2.6 }, { at: [1, 8.2], out: -Math.PI / 2, w: 1.1, y0: 0.76, y1: 2.6 },
    { at: [30.5, 2.43], out: Math.PI / 2, w: 1.58, y0: 1.12, y1: 2.16 },
  ] : [],
  roomN: { z0: -4.4, z1: -1 }, roomS: { z0: 1, z1: 4.8 },
  spawn: [1.3, 0], spawnH: Math.PI / 2, exit: [0.45, 0],
  bateSpawn: [1.3, 7.6], bateExit: [0.45, 7.6],
  T: 0.15,
};
// practice rooms: 1–4 on the north side (west→east), 5–8 on the south side
export const ROOMS = [];
for (let i = 0; i < 8; i++) {
  const north = i < 4, k = i % 4, x0 = 8 + k * 3, x1 = x0 + 3;
  const z0 = north ? L.roomN.z0 : L.roomS.z0, z1 = north ? L.roomN.z1 : L.roomS.z1;
  ROOMS.push({ n: i + 1, north, x0, x1, z0, z1, door: [x0 + 0.75, north ? -1 : 1], open: i === 2 || i === 5 });
}

const STAGE_Y = L.stage.y;
/** floor height (stage + its steps) */
export function groundAt(x, z) {
  const s = L.stage;
  if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return STAGE_Y;
  if (x >= s.x0 - 0.6 && x < s.x0 && Math.abs(z) < 1.2) return STAGE_Y * (x - (s.x0 - 0.6)) / 0.6;   // ramp/steps at the centre
  return 0;
}
/** which named space a point is in */
export function spaceAt(x, z) {
  if (x >= L.hall.x0) return 'hall';
  if (x >= L.corr.x0 && z > L.corr.z0 && z < L.corr.z1) return 'corridor';
  for (const r of ROOMS) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return 'room' + r.n;
  if (z > L.bate.z0) return 'bate';
  return 'lobby';
}

// ------------------------------------------------------------------------------------------- textures
function atlas() {
  const W = 1024, H = 512, cells = {};
  const tex = canvasTex(W, H, (g) => {
    g.fillStyle = '#ddd'; g.fillRect(0, 0, W, H);
    const put = (name, x, y, w, h, draw) => { g.save(); g.translate(x, y); draw(g, w, h); g.restore(); cells[name] = [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H]; };
    const txt = (g, t, x, y, size, col, font = 'Georgia, serif', weight = 'bold') => { g.fillStyle = col; g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y); };
    for (let i = 0; i < 8; i++) put('num' + (i + 1), i * 64, 0, 64, 64, (g, w, h) => { g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#333'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6); txt(g, String(i + 1), w / 2, h / 2 + 2, 40, '#1d2a44', 'Arial, Helvetica, sans-serif'); });
    // booking sheet on a door
    put('sheet', 512, 0, 96, 128, (g, w, h) => {
      g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, w, h); txt(g, 'BOOKINGS', w / 2, 10, 11, '#222', 'Arial, sans-serif');
      g.strokeStyle = '#9ab'; g.lineWidth = 1; for (let r = 0; r < 9; r++) { g.beginPath(); g.moveTo(4, 22 + r * 11); g.lineTo(w - 4, 22 + r * 11); g.stroke(); }
      g.fillStyle = '#23336b'; g.font = 'italic 9px Georgia, serif'; g.textAlign = 'left';
      ['09:00 Emily', '10:00 J. W.', '11:00 —', '12:00 Tom', '14:00 Hannah', '16:00 Choir', '18:00 —', '20:00 ext.'].forEach((s, i) => g.fillText(s, 6, 30 + i * 11));
    });
    put('hallSign', 608, 0, 256, 64, (g, w, h) => { g.fillStyle = '#1c2a4a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9b36a'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8); txt(g, 'Denis Arnold Hall', w / 2, h / 2 + 2, 26, '#f2e6c2'); });
    put('roomsSign', 608, 64, 256, 64, (g, w, h) => { g.fillStyle = '#1c2a4a'; g.fillRect(0, 0, w, h); txt(g, 'Practice Rooms 1–8 →', w / 2, h / 2 + 2, 20, '#f2e6c2'); });   // 24 px overran the 256 px cell: the P and the arrow were cut off
    put('bateSign', 864, 0, 160, 64, (g, w, h) => { g.fillStyle = '#5a1f22'; g.fillRect(0, 0, w, h); txt(g, 'Bate Collection', w / 2, h / 2 - 8, 19, '#f2e6c2'); txt(g, 'of Musical Instruments', w / 2, h / 2 + 14, 12, '#f2e6c2', 'Georgia, serif', 'normal'); });
    put('lodgeSign', 864, 64, 160, 64, (g, w, h) => { g.fillStyle = '#1c2a4a'; g.fillRect(0, 0, w, h); txt(g, 'Porters', w / 2, h / 2 + 2, 24, '#f2e6c2'); });
    put('rules', 0, 64, 256, 160, (g, w, h) => {
      g.fillStyle = '#fffdf4'; g.fillRect(0, 0, w, h); txt(g, 'PRACTICE ROOMS', w / 2, 18, 18, '#7a1a1a', 'Arial, sans-serif');
      g.fillStyle = '#222'; g.font = '13px Arial, sans-serif'; g.textAlign = 'left';
      ['Music students only.', 'Book at the Porters\' Lodge.', 'Please do NOT move the pianos', 'or adjust the acoustic panels.', 'No food or drink.', 'Leave the room as you found it.'].forEach((s, i) => g.fillText(s, 14, 44 + i * 19));
    });
    // notice board: cork with posters
    put('notice', 256, 64, 352, 224, (g, w, h) => {
      g.fillStyle = '#b48a5a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 30},30,0.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.strokeStyle = '#5a3a1a'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
      const poster = (x, y, pw, ph, bg, lines, col = '#222') => { g.save(); g.translate(x, y); g.rotate((Math.random() - 0.5) * 0.08); g.fillStyle = bg; g.fillRect(0, 0, pw, ph); g.fillStyle = col; g.textAlign = 'center'; lines.forEach((l, i) => { g.font = (i === 0 ? 'bold 13px' : '10px') + ' Georgia, serif'; g.fillText(l, pw / 2, 18 + i * 14); }); g.fillStyle = '#c33'; g.beginPath(); g.arc(pw / 2, 4, 3, 0, 7); g.fill(); g.restore(); };
      poster(14, 14, 110, 90, '#fff8d8', ['Lunchtime Recital', 'Denis Arnold Hall', 'Tuesday 1.10pm', 'Free — all welcome']);
      poster(134, 20, 96, 80, '#e8f0ff', ['Choir auditions', 'Michaelmas', 'sign up below'], '#123');
      poster(240, 12, 98, 96, '#fde', ['Bate Collection', 'Open Mon–Fri', '2–5pm', 'Ring the bell']);
      poster(30, 118, 130, 90, '#fff', ['Harmony & Counterpoint', 'Prelims problem sheet 4', 'hand in to pigeonholes']);
      poster(180, 120, 150, 88, '#eef6e8', ['ROOM FOR RENT', 'Jericho, nr. canal', 'no pianos please']);
    });
    // pigeonholes: grid of wooden boxes with names and papers
    put('pigeon', 0, 288, 512, 224, (g, w, h) => {
      g.fillStyle = '#5a3a20'; g.fillRect(0, 0, w, h);
      const cols = 10, rows = 6, cw = w / cols, ch = h / rows, names = ['ADAMS', 'BAKER', 'CHEN', 'DAVIES', 'EVANS', 'FOX', 'GRANT', 'HUGHES', 'IQBAL', 'JONES', 'KHAN', 'LEWIS', 'MORGAN', 'NG', 'OWEN', 'PATEL', 'QUINN', 'REID', 'SHAW', 'TAYLOR'];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * ch; g.fillStyle = '#20140a'; g.fillRect(x + 4, y + 4, cw - 8, ch - 16);
        if ((r * 7 + c * 3) % 4 !== 0) { g.fillStyle = ['#f4f1e8', '#e8e0c8', '#dbe6f2'][(r + c) % 3]; g.fillRect(x + 8, y + ch * 0.45, cw - 16, ch * 0.35); }
        g.fillStyle = '#efe6cc'; g.fillRect(x + 6, y + ch - 12, cw - 12, 9); g.fillStyle = '#222'; g.font = '8px Arial'; g.textAlign = 'center'; g.fillText(names[(r * cols + c) % names.length], x + cw / 2, y + ch - 5);
      }
    });
    // Bate display panels: instrument silhouettes on felt
    const sil = (name, x, draw) => put(name, x, 224, 128, 64, (g, w, h) => { g.fillStyle = '#20302a'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9c08a'; g.strokeStyle = '#d9c08a'; g.lineWidth = 3; draw(g, w, h); });
    sil('silWind', 512, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillRect(14 + i * 28, 6, 6, h - 12); g.beginPath(); g.arc(17 + i * 28, h - 8, 6, 0, 7); g.fill(); } });
    sil('silBrass', 640, (g, w, h) => { g.beginPath(); g.arc(50, 34, 20, 0, 7); g.stroke(); g.beginPath(); g.arc(50, 34, 12, 0, 7); g.stroke(); g.beginPath(); g.moveTo(70, 34); g.quadraticCurveTo(110, 20, 118, 8); g.lineTo(124, 40); g.closePath(); g.fill(); });
    sil('silSerpent', 768, (g, w, h) => { g.lineWidth = 6; g.beginPath(); g.moveTo(10, 50); g.bezierCurveTo(40, 0, 50, 70, 75, 30); g.bezierCurveTo(95, 0, 110, 40, 118, 14); g.stroke(); });
    sil('silKeys', 896, (g, w, h) => { g.fillRect(10, 18, 108, 30); g.fillStyle = '#20302a'; for (let i = 0; i < 18; i++) g.fillRect(14 + i * 6, 36, 3, 10); g.fillStyle = '#d9c08a'; g.fillRect(16, 48, 4, 14); g.fillRect(108, 48, 4, 14); });
  });
  return { tex, cells };
}

function atlasPlane(cells, name, w, h) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, [u0, v0, u1, v1] = cells[name];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return g;
}

// ------------------------------------------------------------------------------------------- build
/** opts.walkin: built as a walk-in room (core/interiors.js "seamless"): the street doorway and L.windows are real
 *  openings (their wall stays solid in the collider: the doorway's way through is the portal's passage), no Bate door */
export function buildInterior(scene, collider, world, opts = {}) {
  const WALK = !!opts.walkin;
  const W = world.mats, B = new MBatch(), A = atlas();
  const fabric = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5f6b78'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},255,0.05)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 2); }
    g.fillStyle = '#3d4650'; g.fillRect(0, 0, w, 4); g.fillRect(0, 0, 4, h);
  }, { repeat: true });
  fabric.repeat.set(1 / 1.2, 1 / 1.2);
  const chequer = canvasTex(256, 256, (g, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#6e4424' : '#8a5a32'; g.fillRect(x * 64, y * 64, 64, 64); g.strokeStyle = '#3a2210'; g.lineWidth = 4; g.strokeRect(x * 64 + 2, y * 64 + 2, 60, 60); }
  }, { repeat: true });
  chequer.repeat.set(1 / 2.4, 1 / 2.4);
  // painted institutional wall, floor to ceiling in one strip (u repeats every metre, v = height in metres up to 3.2):
  // stained skirting, a deeper lower wall with scuffs, timber dado rail, cream above, a picture rail. Wall pieces carry
  // their height in v (see wallRun), so the pieces over doors continue the upper wall instead of restarting at the skirting.
  const wallTex = canvasTex(64, 512, (g, w, h) => {
    const Y = (m) => h - (m / 3.2) * h, band = (y0, y1, c) => { g.fillStyle = c; g.fillRect(0, Y(y1), w, Y(y0) - Y(y1)); };
    band(0, 3.2, '#ece4cc'); band(2.56, 3.2, '#f1ebd8'); band(0.12, 0.94, '#d6cba8');
    let sd = 4711; const r = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '90,80,60'},${0.015 + r() * 0.03})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 2 + r() * 14); }
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(70,62,50,${0.05 + r() * 0.08})`; g.fillRect(r() * w, Y(0.12 + r() * 0.75), 3 + r() * 10, 1 + r() * 2); }     // chair and case scuffs
    band(0, 0.12, '#4a3020'); band(0.105, 0.12, '#6a4a30'); band(0, 0.012, '#2a1a10');
    band(0.94, 1.0, '#6a4628'); band(0.985, 1.0, '#8a6440'); band(0.925, 0.94, 'rgba(60,50,30,0.35)');
    band(2.5, 2.56, '#f8f3e4'); band(2.485, 2.5, 'rgba(80,70,50,0.3)');
  }, { repeat: true });
  wallTex.repeat.set(1, 1 / 3.2);
  const mats = {
    plaster: W.plaster, cream: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }), ceiling: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.95 }),
    wood: W.wood, darkWood: W.darkWood, panelling: W.panelling, carpet: new THREE.MeshStandardMaterial({ map: (() => { const t = world.tex.carpet([58, 66, 84], [72, 80, 100]).clone(); t.repeat.set(1 / 1.5, 1 / 1.5); t.needsUpdate = true; return t; })(), roughness: 1 }),
    lino: new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.6 }), fabric: new THREE.MeshStandardMaterial({ map: fabric, roughness: 1 }),
    door: new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.55 }), frame: new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.6 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x2a2418, emissive: 0xffd8a0, emissiveIntensity: 0.7, roughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.3, metalness: 0.2 }),
    atlas: new THREE.MeshStandardMaterial({ map: A.tex, roughness: 0.8 }),
    tube: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 1.6 }),
    sky: new THREE.MeshStandardMaterial({ color: 0x9fb6cc, emissive: 0xc8daf0, emissiveIntensity: 0.9, roughness: 0.2 }),
    chequer: new THREE.MeshStandardMaterial({ map: chequer, roughness: 0.7 }),
    brass: W.brass, iron: W.iron, mirror: new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.05, metalness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xb8d0d8, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
    stoolTop: new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 0.6 }), stoolWood: W.darkWood,
    caseLight: new THREE.MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xfff0d0, emissiveIntensity: 1.2 }),
    felt: new THREE.MeshStandardMaterial({ color: 0x24362f, roughness: 1 }), radiator: new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.5 }),
  };
  const T = L.T;
  // ---- walls with door gaps. Axis-aligned: wallX (along x at z), wallZ (along z at x). doors: [{at, w, h}]
  const segs = [];
  const wallRun = (horiz, c, a0, a1, h, mat, doors = []) => {
    const ds = doors.slice().sort((p, q) => p.at - q.at);
    let s = a0;
    const piece = (p0, p1, y0, y1) => {
      if (p1 - p0 < 0.01 || y1 - y0 < 0.01) return;
      const g = horiz ? mbox(p1 - p0, y1 - y0, T) : mbox(T, y1 - y0, p1 - p0);
      if (y0 > 0) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) + y0); }      // v = height above the floor
      if (horiz) B.add(mat, g, (p0 + p1) / 2, (y0 + y1) / 2, c); else B.add(mat, g, c, (y0 + y1) / 2, (p0 + p1) / 2);
    };
    for (const d of ds) { const g0 = d.at - d.w / 2, g1 = d.at + d.w / 2; piece(s, g0, 0, h); segs.push([horiz, c, s, g0]); piece(g0, g1, d.h, h); if (d.sill) piece(g0, g1, 0, d.sill); if (d.sill || d.solid) segs.push([horiz, c, g0, g1]); s = g1; }
    piece(s, a1, 0, h); segs.push([horiz, c, s, a1]);
  };
  const lb = L.lobby, cr = L.corr, ht = L.hall, bt = L.bate, ld = L.lodge;
  // lobby + Bate + lodge
  // (windows of the fitted plan as gaps with a sill, by the wall they are in)
  const winOn = (x, out) => (WALK ? L.windows.filter((w) => Math.abs(w.at[0] - x) < 0.01 && Math.abs(w.out - out) < 0.01).map((w) => ({ at: w.at[1], w: w.w, h: w.y1, sill: w.y0 })) : []);
  wallRun(false, lb.x0, lb.z0, lb.z1, lb.h, 'cream', [{ at: L.door.z, w: L.door.w, h: L.door.h, solid: WALK }, ...winOn(lb.x0, -Math.PI / 2).filter((w) => w.at > lb.z0 && w.at < lb.z1)]);                 // west (entrance)
  wallRun(true, lb.z0, lb.x0, lb.x1, lb.h, 'cream', [{ at: 6.1, w: 1.4, h: 1.9 }]);                 // north (porters' hatch: handled below)
  wallRun(true, lb.z1, lb.x0, lb.x1, lb.h, 'cream', [{ at: 6.3, w: 1.2, h: 2.3 }]);                 // south (to the Bate)
  wallRun(false, lb.x1, lb.z0, -cr.z1, lb.h, 'cream'); wallRun(false, lb.x1, cr.z1, lb.z1, lb.h, 'cream');   // east, open to corridor
  { const g = mbox(T, lb.h - cr.h + 0.05, cr.z1 - cr.z0), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) + cr.h - 0.05); B.add('cream', g, lb.x1, (cr.h - 0.05 + lb.h) / 2, 0); }                    // lintel over the corridor opening
  if (WALK) wallRun(false, bt.x0, bt.z0, bt.z1, bt.h, 'cream', winOn(bt.x0, -Math.PI / 2));
  else wallRun(false, bt.x0, bt.z0, bt.z1, bt.h, 'cream', [{ at: 7.6, w: 1.2, h: 2.3 }]);               // Bate west (its own street door)
  wallRun(true, bt.z1, bt.x0, bt.x1, bt.h, 'cream'); wallRun(false, bt.x1, bt.z0, bt.z1, bt.h, 'cream');
  wallRun(false, ld.x0, ld.z0, ld.z1, lb.h, 'cream'); wallRun(true, ld.z0, ld.x0, ld.x1, lb.h, 'cream'); wallRun(false, ld.x1, ld.z0, ld.z1, lb.h, 'cream');
  // hatch: sill below the opening (the opening is 1.0–1.9 m), counter ledge
  B.span('cream', 5.4, 6.8, 0, 1.0, lb.z0 - T / 2, lb.z0 + T / 2); segs.push([true, lb.z0, 5.4, 6.8]);
  B.span('darkWood', 5.35, 6.85, 1.0, 1.05, lb.z0 - 0.3, lb.z0 + 0.22);
  B.span('glass', 5.4, 6.8, 1.05, 1.9, lb.z0 - 0.01, lb.z0 + 0.01);
  // corridor walls with practice-room doors; rooms' party walls
  const nDoors = ROOMS.filter((r) => r.north).map((r) => ({ at: r.door[0], w: 0.9, h: 2.1 })), sDoors = ROOMS.filter((r) => !r.north).map((r) => ({ at: r.door[0], w: 0.9, h: 2.1 }));
  wallRun(true, cr.z0, cr.x0, cr.x1, cr.h, 'cream', nDoors); wallRun(true, cr.z1, cr.x0, cr.x1, cr.h, 'cream', sDoors);
  for (let k = 0; k <= 4; k++) { const x = 8 + k * 3; if (k > 0 && k < 4) { wallRun(false, x, L.roomN.z0, L.roomN.z1, cr.h, 'cream'); wallRun(false, x, L.roomS.z0, L.roomS.z1, cr.h, 'cream'); } }
  wallRun(true, L.roomN.z0, 8, 20, cr.h, 'cream'); wallRun(true, L.roomS.z1, 8, 20, cr.h, 'cream');
  // hall
  wallRun(false, ht.x0, ht.z0, ht.z1, ht.h, 'plaster', [{ at: 0, w: 1.8, h: 2.4 }]);
  wallRun(true, ht.z0, ht.x0, ht.x1, ht.h, 'plaster'); wallRun(true, ht.z1, ht.x0, ht.x1, ht.h, 'plaster'); wallRun(false, ht.x1, ht.z0, ht.z1, ht.h, 'plaster', winOn(ht.x1, Math.PI / 2));
  for (const [horiz, c, a, b] of segs) { if (b - a < 0.05) continue; if (horiz) collider.addSegment(a, c, b, c, { tag: 'wall' }); else collider.addSegment(c, a, c, b, { tag: 'wall' }); }

  // ---- floors + ceilings
  B.span('wood', lb.x0, lb.x1, -0.1, 0, lb.z0, lb.z1); B.span('wood', bt.x0, bt.x1, -0.1, 0, bt.z0, bt.z1); B.span('lino', ld.x0, ld.x1, -0.1, 0, ld.z0, ld.z1);
  B.span('lino', cr.x0, cr.x1, -0.1, 0, cr.z0, cr.z1);
  for (const r of ROOMS) B.span('carpet', r.x0, r.x1, -0.1, 0, r.z0, r.z1);
  B.span('wood', ht.x0, ht.x1, -0.1, 0, ht.z0, ht.z1);
  for (const [a, h] of [[lb, lb.h], [bt, bt.h], [ld, lb.h], [cr, cr.h]]) B.span('ceiling', a.x0, a.x1, h, h + 0.1, a.z0, a.z1);
  B.span('ceiling', 8, 20, cr.h, cr.h + 0.1, L.roomN.z0, L.roomN.z1); B.span('ceiling', 8, 20, cr.h, cr.h + 0.1, L.roomS.z0, L.roomS.z1);
  for (const x of [2.4, 5.6]) B.span('tube', x - 0.3, x + 0.3, lb.h - 0.03, lb.h, -0.6, 0.6);        // flush ceiling lights in the lobby
  B.span('chequer', ht.x0, ht.x1, ht.h, ht.h + 0.1, ht.z0, ht.z1);
  for (let x = ht.x0 + 1.2; x < ht.x1; x += 2.4) B.span('darkWood', x - 0.12, x + 0.12, ht.h - 0.35, ht.h, ht.z0, ht.z1);   // oak beams

  // ---- lobby furniture
  B.add('atlas', atlasPlane(A.cells, 'notice', 2.4, 1.5), 1.9, 1.6, lb.z0 + T / 2 + 0.012, 0);
  B.span('darkWood', 0.8, 4.0, 0, 0.05, lb.z1 - 0.45, lb.z1 - T / 2);
  B.span('darkWood', 0.8, 4.0, 0.9, 2.3, lb.z1 - 0.38, lb.z1 - T / 2); collider.addBox(2.4, lb.z1 - 0.27, 3.2, 0.36, 0);
  B.add('atlas', atlasPlane(A.cells, 'pigeon', 3.1, 1.36), 2.4, 1.6, lb.z1 - 0.385, Math.PI);
  B.add('atlas', atlasPlane(A.cells, 'lodgeSign', 0.7, 0.28), 6.1, 2.2, lb.z0 + T / 2 + 0.01, 0);
  B.add('atlas', atlasPlane(A.cells, 'bateSign', 0.8, 0.32), 6.3, 2.6, lb.z1 - T / 2 - 0.01, Math.PI);
  B.add('atlas', atlasPlane(A.cells, 'roomsSign', 1.0, 0.25), lb.x1 - T / 2 - 0.01, 2.7, -1.6, -Math.PI / 2);
  B.span('darkWood', 5.0, 7.6, 0, 1.0, ld.z0 + 0.3, ld.z0 + 0.9);   // lodge desk (behind the glass)
  B.span('darkWood', 4.4, 4.9, 0, 2.0, -5.4, -3.4);                  // key cabinet
  // bench by the door
  B.span('darkWood', 0.35, 0.8, 0.42, 0.47, -2.6, -0.9); B.span('darkWood', 0.35, 0.8, 0, 0.42, -2.55, -2.45); B.span('darkWood', 0.35, 0.8, 0, 0.42, -1.05, -0.95);
  collider.addBox(0.58, -1.75, 0.45, 1.7, 0);

  // ---- Bate Collection: wall cases and two free-standing cases
  const sils = ['silWind', 'silBrass', 'silSerpent', 'silKeys'];
  for (let i = 0; i < 4; i++) {          // along the south wall
    const x = bt.x0 + (FIT ? 0.85 : 1.2) + i * 1.75;
    B.span('darkWood', x - 0.8, x + 0.8, 0, 0.8, bt.z1 - 0.6, bt.z1 - T / 2); B.span('felt', x - 0.78, x + 0.78, 0.8, 2.3, bt.z1 - T / 2 - 0.02, bt.z1 - T / 2);
    B.add('atlas', atlasPlane(A.cells, sils[i], 1.4, 0.7), x, 1.2, bt.z1 - T / 2 - 0.03, Math.PI);
    B.span('glass', x - 0.8, x + 0.8, 0.8, 2.3, bt.z1 - 0.6, bt.z1 - 0.59); B.span('caseLight', x - 0.7, x + 0.7, 2.28, 2.3, bt.z1 - 0.5, bt.z1 - 0.2);
    collider.addBox(x, bt.z1 - 0.37, 1.6, 0.5, 0);
  }
  for (const [x, z] of [[3.2, 5.6], [5.8, 5.6]]) {
    B.span('darkWood', x - 0.7, x + 0.7, 0, 0.85, z - 0.4, z + 0.4); B.span('felt', x - 0.66, x + 0.66, 0.85, 0.87, z - 0.36, z + 0.36);
    B.add('atlas', atlasPlane(A.cells, sils[(x > 4 ? 1 : 2)], 1.1, 0.55).rotateX(-Math.PI / 2), x, 0.875, z, 0);
    for (const s of [-1, 1]) { B.span('glass', x - 0.7, x + 0.7, 0.87, 1.35, z + s * 0.4 - 0.005, z + s * 0.4 + 0.005); B.span('glass', x + s * 0.7 - 0.005, x + s * 0.7 + 0.005, 0.87, 1.35, z - 0.4, z + 0.4); }
    B.span('glass', x - 0.7, x + 0.7, 1.35, 1.36, z - 0.4, z + 0.4);
    collider.addBox(x, z, 1.45, 0.85, 0);
  }

  // ---- corridor: tube lights, radiators, sign, doors
  for (let x = 9.5; x < 20; x += 3) B.span('tube', x - 0.6, x + 0.6, cr.h - 0.05, cr.h, -0.08, 0.08);
  B.add('atlas', atlasPlane(A.cells, 'rules', 0.62, 0.39), 9.4, 1.35, cr.z1 - T / 2 - 0.01, Math.PI);
  B.add('atlas', atlasPlane(A.cells, 'hallSign', 1.0, 0.25), cr.x1 - 0.6, 2.5, cr.z0 + T / 2 + 0.01, 0);
  const doors = [];
  for (const r of ROOMS) {
    const s = r.north ? 1 : -1, dz = r.door[1], face = r.north ? 0 : Math.PI;   // corridor side normal: +z for north doors
    // frame
    B.span('frame', r.door[0] - 0.5, r.door[0] - 0.45, 0, 2.15, dz - 0.09, dz + 0.09); B.span('frame', r.door[0] + 0.45, r.door[0] + 0.5, 0, 2.15, dz - 0.09, dz + 0.09); B.span('frame', r.door[0] - 0.5, r.door[0] + 0.5, 2.1, 2.16, dz - 0.09, dz + 0.09);
    const plateZ = dz + s * 0.1;
    if (r.open) {
      // door swung open into the room against the party wall
      const hx = r.door[0] - 0.45, inZ = dz - s * 0.05;
      B.span('door', hx - 0.02, hx + 0.03, 0, 2.08, r.north ? inZ - 0.88 : inZ, r.north ? inZ : inZ + 0.88);
    } else {
      B.span('door', r.door[0] - 0.45, r.door[0] + 0.45, 0, 2.08, dz - 0.03, dz + 0.03);
      B.span('glow', r.door[0] - 0.08, r.door[0] + 0.08, 1.35, 1.8, dz - 0.035, dz + 0.035);      // small window: lit inside
      B.span('brass', r.door[0] + 0.33, r.door[0] + 0.4, 1.0, 1.04, dz + s * 0.05, dz + s * 0.08);
      collider.addSegment(r.door[0] - 0.45, dz, r.door[0] + 0.45, dz, { tag: 'door' });
    }
    B.add('atlas', atlasPlane(A.cells, 'num' + r.n, 0.14, 0.14), r.door[0] + (r.open ? 0.65 : 0), 1.85, plateZ + s * (r.open ? -0.03 : 0), face);
    B.add('atlas', atlasPlane(A.cells, 'sheet', 0.19, 0.26), r.door[0] + (r.open ? 0.68 : -0.24), 1.25, plateZ + s * (r.open ? -0.03 : 0), face);
    doors.push(r);
    // room dressing: acoustic panels on two walls, ceiling tube, radiator
    const cx = (r.x0 + r.x1) / 2, back = r.north ? r.z0 : r.z1, bs = r.north ? 1 : -1;
    for (const px of [r.x0 + 0.75, r.x0 + 1.5, r.x0 + 2.25]) B.span('fabric', px - 0.32, px + 0.32, 1.0, 2.4, back + bs * (T / 2), back + bs * (T / 2 + 0.05));
    for (const pz of [0.3, 0.6]) { const zz = r.z0 + (r.z1 - r.z0) * pz; B.span('fabric', r.x1 - T / 2 - 0.05, r.x1 - T / 2, 1.0, 2.4, zz - 0.5, zz + 0.5); }
    B.span('tube', cx - 0.5, cx + 0.5, cr.h - 0.05, cr.h, (r.z0 + r.z1) / 2 - 0.1, (r.z0 + r.z1) / 2 + 0.1);
    B.span('radiator', r.x0 + T / 2, r.x0 + T / 2 + 0.08, 0.15, 0.75, (r.z0 + r.z1) / 2 - 0.5, (r.z0 + r.z1) / 2 + 0.5);
  }

  // ---- hall: panelling to the window base, tall windows both sides, stage, chairs
  for (const z of [ht.z0 + T / 2, ht.z1 - T / 2]) B.span('panelling', ht.x0, ht.x1, 0, 2.4, z - (z < 0 ? -0.0 : 0.04), z + (z < 0 ? 0.04 : 0));
  { const ew = WALK ? L.windows.find((w) => w.at[0] === ht.x1) : null;
    if (ew) { B.span('panelling', ht.x1 - T / 2 - 0.04, ht.x1 - T / 2, 0, 2.4, ht.z0, ew.at[1] - ew.w / 2); B.span('panelling', ht.x1 - T / 2 - 0.04, ht.x1 - T / 2, 0, 2.4, ew.at[1] + ew.w / 2, ht.z1); B.span('panelling', ht.x1 - T / 2 - 0.04, ht.x1 - T / 2, 0, ew.y0, ew.at[1] - ew.w / 2, ew.at[1] + ew.w / 2); if (ew.y1 < 2.4) B.span('panelling', ht.x1 - T / 2 - 0.04, ht.x1 - T / 2, ew.y1, 2.4, ew.at[1] - ew.w / 2, ew.at[1] + ew.w / 2); }
    else B.span('panelling', ht.x1 - T / 2 - 0.04, ht.x1 - T / 2, 0, 2.4, ht.z0, ht.z1); }
  B.span('panelling', ht.x0 + T / 2, ht.x0 + T / 2 + 0.04, 0, 2.4, ht.z0, -0.95); B.span('panelling', ht.x0 + T / 2, ht.x0 + T / 2 + 0.04, 0, 2.4, 0.95, ht.z1);
  // (the free plan's bright side panes: in the fitted plan both long walls are inside the building — no windows there)
  if (!FIT) for (let x = ht.x0 + 1.6; x < ht.x1 - 0.8; x += 2.4) for (const z of [ht.z0 + T / 2 + 0.01, ht.z1 - T / 2 - 0.01]) {
    const dzn = z < 0 ? 1 : -1;
    B.span('sky', x - 0.55, x + 0.55, 2.8, 5.6, z - 0.005, z + 0.005);
    B.span('frame', x - 0.62, x + 0.62, 2.72, 2.8, z, z + dzn * 0.12); B.span('frame', x - 0.62, x + 0.62, 5.6, 5.68, z, z + dzn * 0.06);
    B.span('frame', x - 0.03, x + 0.03, 2.8, 5.6, z, z + dzn * 0.04); for (const y of [3.7, 4.65]) B.span('frame', x - 0.55, x + 0.55, y - 0.03, y + 0.03, z, z + dzn * 0.04);
  }
  const st = L.stage;
  B.span('wood', st.x0, st.x1, 0, st.y, st.z0, st.z1);
  for (let i = 0; i < 2; i++) B.span('wood', st.x0 - 0.3 * (i + 1), st.x0 - 0.3 * i, 0, st.y * (2 - i) / 3, -1.2, 1.2);
  segs.length = 0;
  collider.addSegment(st.x0, st.z0, st.x0, -1.2, { tag: 'stage', low: true }); collider.addSegment(st.x0, 1.2, st.x0, st.z1, { tag: 'stage', low: true });
  collider.addSegment(st.x0, st.z0, st.x1, st.z0, { tag: 'stage', low: true }); collider.addSegment(st.x0, st.z1, st.x1, st.z1, { tag: 'stage', low: true });

  // chairs: one instanced mesh for seats/backs (plastic-and-steel stacking chairs: a guess) + one for the frames
  const seatG = mbox(0.44, 0.05, 0.42).translate(0, 0.45, 0), backG = mbox(0.44, 0.36, 0.04).translate(0, 0.74, -0.2);
  const chairTop = new THREE.BufferGeometry().copy(seatG.toNonIndexed()); { const b2 = backG.toNonIndexed(); const merged = mergeTwo(chairTop, b2); chairTop.copy(merged); }
  const legs = []; for (const sx of [-0.19, 0.19]) for (const sz of [-0.18, 0.18]) legs.push(mbox(0.025, 0.45, 0.025).translate(sx, 0.225, sz).toNonIndexed());
  let legG = legs[0]; for (let i = 1; i < legs.length; i++) legG = mergeTwo(legG, legs[i]);
  const chairs = [];
  const NR = L.chairRows, NK = FIT ? 4 : 5;
  for (let r = 0; r < NR; r++) for (const side of [-1, 1]) for (let k = 0; k < NK; k++) chairs.push([22.3 + r * 0.95, side * (0.75 + k * 0.56)]);
  const ch1 = new THREE.InstancedMesh(chairTop, new THREE.MeshStandardMaterial({ color: 0x1f2c4c, roughness: 0.7 }), chairs.length);
  const ch2 = new THREE.InstancedMesh(legG, W.iron, chairs.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), one = new THREE.Vector3(1, 1, 1);
  chairs.forEach(([x, z], i) => { m4.compose(new THREE.Vector3(x, 0, z), q, one); ch1.setMatrixAt(i, m4); ch2.setMatrixAt(i, m4); });
  scene.add(ch1, ch2);
  for (let r = 0; r < NR; r++) for (const side of [-1, 1]) collider.addBox(22.3 + r * 0.95, side * (0.75 + (NK - 1) / 2 * 0.56), 0.5, NK * 0.54, 0);

  // ---- pianos
  const pianos = [];
  const addPiano = (kind, x, z, h, room, label) => {
    const p = createPiano(kind); p.group.position.set(x, room === 'hall' ? STAGE_Y : 0, z); p.group.rotation.y = h; scene.add(p.group);
    const c = Math.cos(h), s = Math.sin(h), loc = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const seat = loc(p.seat[0], p.seat[1]);
    const y0 = room === 'hall' ? STAGE_Y : 0;
    addStool(B, seat[0], seat[1], h, 0.62, y0);
    // collision: the case (approximate box in piano-local space)
    const len = kind === 'upright' ? 0.62 : kind === 'grand' ? 1.75 : 2.9, wid = kind === 'upright' ? 1.55 : 1.6;
    const cc = loc(0, kind === 'upright' ? -0.33 : -len / 2 + 0.05);
    collider.addBox(cc[0], cc[1], wid, kind === 'upright' ? 0.62 : len, h);
    pianos.push({ id: room, kind, piano: p, room, label, seat, heading: h + Math.PI, y0, loc });
  };
  addPiano('upright', 15.6, L.roomN.z0 + T / 2 + 0.64, 0, 'room3', 'Practice Room 3 — upright');
  addPiano('grand', 12.7, 2.72, Math.PI, 'room6', 'Practice Room 6 — grand');
  addPiano('steinway', L.steinway[0], L.steinway[1], Math.PI, 'hall', 'Denis Arnold Hall — Steinway');
  // music stand + mirror + chair in room 3; music stand in room 6
  const stand = (x, z, rot) => { B.add('iron', new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), x, 0.55, z); B.add('iron', mbox(0.5, 0.34, 0.01), x, 1.2, z, [-0.35, rot, 0, 'YXZ']); B.add('iron', new THREE.CylinderGeometry(0.2, 0.2, 0.01, 8), x, 0.005, z); };
  stand(14.4, -2.2, 0.5); stand(13.9, 1.9, Math.PI + 0.6);
  B.span('mirror', 16.97 - 0.02, 16.97, 0.9, 1.9, -3.0, -2.2); B.span('frame', 16.95 - 0.04, 16.95, 0.86, 1.94, -3.04, -2.16);
  KChair(B, 16.3, -1.6, -2.4);
  // stage furniture: a second music stand and a page-turner's chair
  stand(FIT ? 28.6 : 33.0, FIT ? 2.6 : 2.4, Math.PI); KChair(B, L.steinway[0] - 1.0, L.steinway[1] - 0.6, Math.PI / 2, STAGE_Y);

  const meshes = B.build(mats, { shadows: false, name: 'music-interior' });
  scene.add(meshes);

  // ---- lights (6)
  const lights = [];
  const pl = (x, y, z, i, d, col = 0xfff2dc) => { const l = new THREE.PointLight(col, i, d, 1.4); l.position.set(x, y, z); scene.add(l); lights.push(l); return l; };
  pl(4, 2.9, 0, 9, 11, 0xffe6c0);
  pl(14, 2.75, 0, 7, 10, 0xf4f6ff);
  pl(15.5, 2.75, -2.7, 6, 6, 0xf4f6ff);
  pl(12.5, 2.75, 2.9, 6, 6, 0xf4f6ff);
  pl(25, Math.min(5.6, L.hall.h - 0.7), 0, 22, 18, 0xffe4c4);
  const spot = new THREE.SpotLight(0xfff0dc, 40, 14, 0.55, 0.6, 1.3); spot.position.set(L.steinway[0] - 3.1, Math.min(6.0, L.hall.h - 0.3), -1); spot.target.position.set(L.steinway[0], 0.8, 0); scene.add(spot, spot.target); lights.push(spot);
  return { pianos, rooms: ROOMS, lights, mats, atlas: A };
}

function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const A = a.attributes[k], Bq = b.attributes[k]; if (!A || !Bq) continue;
    const arr = new Float32Array(A.array.length + Bq.array.length); arr.set(A.array, 0); arr.set(Bq.array, A.array.length);
    g.setAttribute(k, new THREE.BufferAttribute(arr, A.itemSize));
  }
  return g;
}
function KChair(B, x, z, rot, y = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  B.add('darkWood', mbox(0.44, 0.05, 0.42), x, y + 0.45, z, rot);
  B.add('darkWood', mbox(0.44, 0.45, 0.04), x - 0.2 * s, y + 0.7, z - 0.2 * c, rot);
  for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) B.add('darkWood', mbox(0.035, 0.45, 0.035), x + lx * c + lz * s, y + 0.225, z - lx * s + lz * c, rot);
}
