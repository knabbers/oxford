// Andrew Wiles Building interiors (owned by places/maths.js):
//   buildInstitute(ctx, game)  'maths_institute': entrance lobby + reception, the stair and the lift (a real car:
//                              _maths_lift.js) down to the mezzanine with the two glass "crystals" (K3,3 and a
//                              Laplacian eigenfunction), café, noticeboards, doors to L1–L6 (L1's is a real doorway).
//   buildTheatre(ctx, game)    'maths_lecture': Lecture Theatre 1 (360 seats, raked), boards, bench, screen, clock —
//                              a walk-in room OFF the mezzanine (core/interiors.js room-to-room portal), through a fire door.
// Sourced: mezzanine below ground holds all teaching rooms; L1 360 / L2 210 / L3 110 raked, L4–L6 70/70/50; crystals bring
// daylight from the ground-floor atria (glass + dark steel frame, timber-slatted galleries, white walls, grey carpet:
// Commons photo Dec 2013); café; lifts. Guessed: the plan (positions of everything), finishes not visible in photos,
// L1's shape and board arrangement.
import * as THREE from 'three';
import { canvasScale, hiAniso } from '../world/_surf_detail.js';   // texture pass 2: larger canvases and 16x anisotropy on the top tier only
import { Batch } from './_maths_geo.js';
import { makeLift } from './_maths_lift.js';

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide, ...o });
function canvas(w, h) { const c = document.createElement('canvas'), k = canvasScale(w, h); c.width = w * k; c.height = h * k; if (k !== 1) c.getContext('2d').scale(k, k); return c; }   // (texture pass 2: twice the pixels on the top tier; painters draw in w x h units)
function tex(c, rx = 1, ry = 1) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(rx, ry); t.anisotropy = hiAniso(4); return t; }
function noiseTex(base, amp, seed, size = 256) {
  const c = canvas(size, size), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, size, size);
  let a = seed; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = 0; i < size * size * 0.15; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${r() * amp})` : `rgba(255,255,255,${r() * amp})`; g.fillRect(r() * size, r() * size, 2, 2); }
  return c;
}
function slatsTex() {
  const c = canvas(256, 64), g = c.getContext('2d'); g.fillStyle = '#3a2716'; g.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 16) { const s = 130 + ((x * 37) % 30); g.fillStyle = `rgb(${s + 50},${s + 2},${s - 55})`; g.fillRect(x + 2, 0, 11, 64); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 3, 0, 2, 64); }
  return c;
}

/** canvas atlas of signs (cells 256×96 in a 1024×768 grid) */
function signAtlas(entries) {
  const c = canvas(1024, 768), g = c.getContext('2d'), cells = {};
  entries.forEach(([key, text, bg, fg, size], i) => {
    const cx = (i % 4) * 256, cy = Math.floor(i / 4) * 96;
    g.fillStyle = bg; g.fillRect(cx + 2, cy + 2, 252, 92);
    g.fillStyle = fg; g.font = `${size || 46}px "Helvetica Neue", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, cx + 128, cy + 50);
    cells[key] = [cx / 1024, 1 - (cy + 96) / 768, (cx + 256) / 1024, 1 - cy / 768];
  });
  return { texture: tex(c), cells };
}

/** posters on cork: one canvas per noticeboard */
function noticeboardTex(posters, seed) {
  const W = 1024, H = 480, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#9c7a52'; g.fillRect(0, 0, W, H);
  let a = seed; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,40,20' : '200,170,120'},${r() * 0.3})`; g.fillRect(r() * W, r() * H, 2, 2); }
  const wrap = (text, x, y, w, lh) => { const words = text.split(' '); let line = ''; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > w && line) { g.fillText(line, x, y); y += lh; line = wd; } else line = t; } if (line) g.fillText(line, x, y); return y; };
  posters.forEach((p, i) => {
    const pw = 230, ph = 210, x = 20 + (i % 4) * 250 + (r() - 0.5) * 8, y = 18 + Math.floor(i / 4) * 235 + (r() - 0.5) * 8;
    g.save(); g.translate(x + pw / 2, y + ph / 2); g.rotate((r() - 0.5) * 0.05); g.translate(-pw / 2, -ph / 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, 5, pw, ph);
    g.fillStyle = p.bg || '#f6f4ee'; g.fillRect(0, 0, pw, ph);
    g.fillStyle = p.band || '#002147'; g.fillRect(0, 0, pw, 38);
    g.fillStyle = '#fff'; g.font = 'bold 17px Arial, sans-serif'; g.textAlign = 'left'; g.fillText(p.series, 10, 25);
    g.fillStyle = '#1b1b1b'; g.font = 'bold 19px Georgia, serif'; let yy = wrap(p.title, 10, 68, pw - 20, 23);
    g.font = '15px Arial, sans-serif'; g.fillStyle = '#444'; wrap(p.when, 10, Math.max(yy + 32, 150), pw - 20, 18);
    g.fillStyle = '#c02020'; g.beginPath(); g.arc(pw / 2, 8, 5, 0, 7); g.fill();
    g.restore();
  });
  return tex(c);
}

const POSTERS_A = [
  { series: 'Number Theory Seminar', title: 'Rational points on curves of genus two', when: 'Monday 4pm, L6' },
  { series: 'Topology Seminar', title: 'Knot Floer homology for the curious', when: 'Tuesday 3.30pm, L6' },
  { series: 'Applied Maths Colloquium', title: 'Folding, crumpling and the mechanics of paper', when: 'Friday 4pm, L2', band: '#5a2a6e' },
  { series: 'Logic Seminar', title: 'Model theory of valued fields', when: 'Tuesday 2pm, C2' },
  { series: 'Mathematical Biology', title: 'Turing patterns on growing domains', when: 'Thursday 2pm, L5', band: '#2a6e3a' },
  { series: 'Junior Geometry & Topology', title: 'Surfaces of constant curvature, by hand', when: 'Wednesday 1pm, C3 (lunch provided)' },
  { series: 'The Invariants', title: 'Penrose tilings and aperiodic order', when: 'Tuesday 8.15pm, L3. All welcome', band: '#9a2a2a' },
  { series: 'Prelims, Michaelmas Term', title: 'M2: Analysis I — Sequences and Series. Dr Richard Earl', when: 'L1. Lectures 1–4 in rotation, every 12 minutes — see the screen by the door', bg: '#fffbe8', band: '#8a6d1a' },
];
const POSTERS_B = [
  { series: 'Analytic Topology', title: 'Compactness, revisited', when: 'Thursday 4pm, C1' },
  { series: 'Fluid Dynamics Seminar', title: 'Why the tea leaves gather in the middle', when: 'Monday 2.15pm, L5', band: '#1f5e7a' },
  { series: 'Combinatorics Seminar', title: 'Ramsey numbers: small cases, big ideas', when: 'Tuesday 2pm, L5' },
  { series: 'Undergraduate Notices', title: 'Collections timetable now posted. Problem sheets: hand in by noon', when: 'Academic Administration', bg: '#eef3ff' },
  { series: 'Stochastic Analysis', title: 'Rough paths without tears', when: 'Monday 3.30pm, L4', band: '#3a3a6e' },
  { series: 'Algebra Seminar', title: 'Representations of finite groups in characteristic p', when: 'Tuesday 4pm, C1' },
  { series: 'Public Lecture', title: 'The mathematics of symmetry', when: 'Wednesday 5pm, L1. Free, no booking', band: '#6e2a50' },
  { series: 'Lost property', title: 'One scarf (striped), one calculator, many umbrellas', when: 'Ask at Reception', bg: '#fff' },
];

// ------------------------------------------------------------------------------------------------ institute
export const INST = {
  lobby: { x0: -9, x1: 9, z0: 4, z1: 28 }, stair: { x0: -2.4, x1: 2.4, z0: 4, z1: 16 }, MEZ: -4.5,
  mez: { x0: -20, x1: 20, z0: -30, z1: 4 }, ceil: -0.5,
  k33: { x: -10, z: -12, r: 4.6 }, eig: { x: 10, z: -13, s: 8.4 },
  cafe: { x0: 10, x1: 18, z: 0.6 },
  liftX: -6,
  // the lift shaft (GUESS: its place): behind the lobby's north wall, standing in the mezzanine against its south wall —
  // a through car: the lobby's door in its south end, the mezzanine's in its north end
  lift: { x0: -7.1, x1: -4.9, z0: 1.9, z1: 4, w: 1.2, h: 2.1, top: 2.6 },
  l1: { w: 1.2, h: 2.2, depth: 0.3 },       // the real doorway of Lecture Theatre 1 (the active leaf's opening; wall thickness)
  doors: { L1: [-11, -30], L2: [0, -30], L3: [11, -30], L4: [-20, -23], L5: [-20, -13], L6: [20, -23] },
};

export function instituteGround(x, z) {
  const S = INST.stair;
  if (z > S.z0 && z <= S.z1 + 0.01 && x > S.x0 && x < S.x1) return INST.MEZ * (S.z1 - z) / (S.z1 - S.z0);
  if (z > S.z0) return 0;
  return INST.MEZ;
}

// Walk-in (maths.js; core/interiors.js "seamless"): the lobby is in place in the glazed link behind the east entrance.
// `plan` (places/_walkin_city.js) set = the entrance wall is real: an automatic sliding pair in the middle, glazing
// either side and over it as declared openings (the Penrose paving and the street through them), and the roof kept
// under the exterior's glass roof (RH). The mezzanine and the theatres are below ground, as in the real building.
export const ENTR = { doorW: 2.8, doorH: 2.6, sideX: 4.5, sideW: 5.2, y0: 0.05, y1: 5.0, half: 7.25 };
export function buildInstitute(ctx, game, plan = null) {
  const s = ctx.scene, col = ctx.collider, B = new Batch(), SL = !!(ctx.seamless && plan), RH = SL ? 11.5 : 12, WH = SL ? 11.5 : 12.4;
  const L = INST.lobby, S = INST.stair, M = INST.mez, Y = INST.MEZ, C = INST.ceil;
  const floorTex = tex(noiseTex('#cfcfcb', 0.08, 11), 1 / 3, 1 / 3);
  const signs = signAtlas([
    ['L1', 'L1', '#1d2b3a', '#fff'], ['L2', 'L2', '#1d2b3a', '#fff'], ['L3', 'L3', '#1d2b3a', '#fff'], ['L4', 'L4', '#1d2b3a', '#fff'],
    ['L5', 'L5', '#1d2b3a', '#fff'], ['L6', 'L6', '#1d2b3a', '#fff'], ['cafe', 'Café π', '#f4efe6', '#3b2a1a', 50], ['lift', 'Lifts', '#1d2b3a', '#fff'],
    ['theatres', 'Lecture Theatres ↓', '#1d2b3a', '#fff', 34], ['north', 'North Mezzanine', '#f2f2f2', '#1d2b3a', 30], ['south', 'South Mezzanine', '#f2f2f2', '#1d2b3a', 30],
    ['reception', 'Reception', '#f2f2f2', '#1d2b3a', 40], ['menu', 'Coffee £1.80', '#1c1c1c', '#f5e9c8', 40], ['class', 'C1–C6 →', '#1d2b3a', '#fff', 42],
    ['institute', 'Mathematical Institute', '#002147', '#fff', 26], ['exit', 'Way out ↑', '#1f7a3a', '#fff', 40],
  ]);
  const mats = {
    floor: std({ map: floorTex, roughness: 0.35 }),
    carpet: std({ map: tex(noiseTex('#55585c', 0.12, 23), 1 / 2, 1 / 2), roughness: 1 }),
    white: std({ color: 0xf1f0ec, roughness: 0.9 }),
    ceiling: std({ color: 0xf4f4f2, roughness: 1, emissive: 0x303030 }),
    slats: std({ map: tex(slatsTex(), 1 / 2.4, 1 / 0.6), roughness: 0.7 }),
    steel: std({ color: 0x2b2f33, roughness: 0.45, metalness: 0.6 }),
    stainless: std({ color: 0xb9bfc4, roughness: 0.3, metalness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    sky: new THREE.MeshBasicMaterial({ color: 0xf4f8ff, side: THREE.DoubleSide }),
    glassRoof: new THREE.MeshBasicMaterial({ color: 0xcfe2f0, side: THREE.DoubleSide }),
    oak: std({ color: 0xb98a55, roughness: 0.6 }),
    dark: std({ color: 0x2a2a2c, roughness: 0.6 }),
    chair: std({ color: 0x3e5a7a, roughness: 0.7 }),
    signs: std({ map: signs.texture, roughness: 0.6, side: THREE.FrontSide }),
    counter: std({ color: 0xe6e2da, roughness: 0.5 }),
    rubber: std({ color: 0x1d1d1f, roughness: 0.9 }),
    liftSteel: std({ color: 0xc4c8cc, roughness: 0.5, metalness: 0.25 }),      // (brushed: the lift car's lining and every lift door leaf)
  };

  // ---------------------------------------------------------------- lobby (ground floor)
  B.flat('floor', [[L.x0, L.z0], [L.x1, L.z0], [L.x1, L.z1], [L.x0, L.z1]], 0, false, 1, [[[S.x0, S.z0], [S.x1, S.z0], [S.x1, S.z1], [S.x0, S.z1]]]);
  // walls: timber slats on the sides above a white dado, glazing at both ends
  const lobbyH = (z) => 5.6 + (RH - 5.6) * (L.z1 - z) / (L.z1 - L.z0);
  B.wall('white', L.x0, L.z1, L.x0, L.z0, 0, WH, 1, 1);           // west wall (normal east)
  B.wall('white', L.x1, L.z0, L.x1, L.z1, 0, WH, 1, 1);           // east wall
  B.wall('slats', L.x0 + 0.05, L.z1 - 1, L.x0 + 0.05, L.z0 + 1, 3.2, 5.2, 1, 1);
  B.wall('slats', L.x1 - 0.05, L.z0 + 1, L.x1 - 0.05, L.z1 - 1, 3.2, 5.2, 1, 1);
  // entrance glazing (south) and north wall (glass above, wall with lifts below)
  if (!SL) B.wall('glassRoof', L.x1, L.z1, L.x0, L.z1, 0, 5.6, 1, 1);
  else {      // the real entrance wall: white ends and head, steel posts; the glass is the openings' (maths.js)
    const E = ENTR, z = L.z1, W = (xa, xb, y0, y1, m = 'white') => B.wall(m, xa, z, xb, z, y0, y1, 1, 1);
    W(L.x1, E.half, 0, 5.6); W(-E.half, L.x0, 0, 5.6); W(E.half, -E.half, E.y1, 5.6);
    W(E.half, E.sideX + E.sideW / 2, 0, E.y1); W(-E.sideX - E.sideW / 2, -E.half, 0, E.y1);
    for (const sx of [-1, 1]) B.aabb('steel', sx * (E.doorW / 2 + 0.15) - 0.15, 0, z - 0.14, sx * (E.doorW / 2 + 0.15) + 0.15, E.y1, z);
    B.aabb('steel', -E.doorW / 2, E.doorH, z - 0.14, E.doorW / 2, E.doorH + 0.15, z);
    B.aabb('white', -E.half, 0, z - 0.1, -E.doorW / 2 - 0.3, E.y0, z); B.aabb('white', E.doorW / 2 + 0.3, 0, z - 0.1, E.half, E.y0, z);
  }
  const LF = INST.lift, lx = INST.liftX, la = lx - LF.w / 2, lb = lx + LF.w / 2;      // (the lift's doorway is a real hole in this wall)
  B.wall('white', L.x0, L.z0, la, L.z0, 0, WH, 1, 1); B.wall('white', lb, L.z0, S.x0, L.z0, 0, WH, 1, 1); B.wall('white', la, L.z0, lb, L.z0, LF.h, WH, 1, 1);
  B.wall('white', S.x1, L.z0, L.x1, L.z0, 0, WH, 1, 1); B.wall('white', S.x0, L.z0, S.x1, L.z0, 0.2, WH, 1, 1);
  B.wall('glassRoof', L.x0 + 0.5, L.z0 + 0.05, L.x1 - 0.5, L.z0 + 0.05, 5.4, RH, 1, 1);
  // sloping glass roof with mullions
  B.quad('glassRoof', [L.x0, RH, L.z0], [L.x1, RH, L.z0], [L.x1, 5.6, L.z1], [L.x0, 5.6, L.z1]);
  for (let x = L.x0; x <= L.x1 + 0.01; x += 2.25) B.bar('steel', [x, RH - 0.05, L.z0], [x, 5.55, L.z1], 0.12);
  for (let z = L.z0; z <= L.z1; z += 3) B.bar('steel', [L.x0, lobbyH(z) - 0.06, z], [L.x1, lobbyH(z) - 0.06, z], 0.1);
  col.addSegment(L.x0, L.z0, L.x0, L.z1); col.addSegment(L.x1, L.z0, L.x1, L.z1); col.addSegment(L.x0, L.z1, L.x1, L.z1);
  col.addSegment(L.x0, L.z0, la, L.z0); col.addSegment(lb, L.z0, S.x0, L.z0); col.addSegment(S.x1, L.z0, L.x1, L.z0);      // (the gap is the lift door's own block)
  // entrance doors (sliding, framed)
  if (!SL) B.aabb('steel', -1.6, 0, L.z1 - 0.1, 1.6, 2.6, L.z1 - 0.02); // drawn as a frame band; glass beyond
  // reception desk (white, oak top) + sign
  B.aabb('counter', -7.2, 0, 15, -3.6, 1.05, 16.2); B.aabb('oak', -7.3, 1.05, 14.9, -3.5, 1.12, 16.3);
  col.addBox(-5.4, 15.6, 3.8, 1.4);
  signQuad(B, signs.cells.reception, -5.4, 0.62, 16.23, 2.0, 0.6, 0);   // on the desk front, facing the door
  signQuad(B, signs.cells.institute, 0, 4.2, L.z0 + 0.06, 3.6, 1.2, 0);
  // stair: balustrades (glass + oak handrail) along the opening, steps down to the mezzanine
  for (const x of [S.x0, S.x1]) {
    B.quad2('glass', [x, 0, S.z1], [x, 1.1, S.z1], [x, 1.1, S.z0], [x, 0, S.z0]);
    B.bar('oak', [x, 1.12, S.z1], [x, 1.12, S.z0], 0.07);
    col.addSegment(x, S.z0 - 0.2, x, S.z1);
    // stair side walls below the floor
    B.wall('slats', x, S.z1, x, S.z0, Y - 0.2, 0, 1, 1);
    B.wall('slats', x, S.z0, x, S.z1, Y - 0.2, 0, 1, 1);
  }
  B.quad2('glass', [S.x0, 0, S.z0 + 0.02], [S.x0, 1.1, S.z0 + 0.02], [S.x1, 1.1, S.z0 + 0.02], [S.x1, 0, S.z0 + 0.02]);
  {
    const n = 26, run = (S.z1 - S.z0) / n, rise = -Y / n;
    for (let i = 0; i < n; i++) {
      const z1 = S.z1 - i * run, z0 = z1 - run, y = -(i + 1) * rise;
      B.aabb('floor', S.x0, y - 0.05, z0, S.x1, y + rise, z1);
    }
  }
  // the lift: a stainless surround round each landing door, the shaft standing in the mezzanine (white, as the walls),
  // dark inside; the car and the doors themselves are _maths_lift.js
  {
    const z = L.z0 + 0.04;
    B.aabb('stainless', lx - 1.0, 0, z - 0.03, la, 2.3, z + 0.03); B.aabb('stainless', lb, 0, z - 0.03, lx + 1.0, 2.3, z + 0.03); B.aabb('stainless', la, LF.h, z - 0.03, lb, 2.3, z + 0.03);
    signQuad(B, signs.cells.lift, lx, 2.75, z + 0.01, 1.1, 0.42, 0);
    B.wall('white', LF.x0, LF.z0, LF.x0, LF.z1, Y, LF.top, 1, 1); B.wall('white', LF.x1, LF.z1, LF.x1, LF.z0, Y, LF.top, 1, 1);
    B.wall('white', LF.x0, LF.z0, la, LF.z0, Y, LF.top, 1, 1); B.wall('white', lb, LF.z0, LF.x1, LF.z0, Y, LF.top, 1, 1); B.wall('white', la, LF.z0, lb, LF.z0, Y + LF.h, LF.top, 1, 1);
    B.wall('dark', LF.x0, LF.z1 - 0.005, LF.x1, LF.z1 - 0.005, C, 0, 1, 1);      // (the edge of the lobby's floor slab, seen from the car)
    B.flat('dark', [[LF.x0, LF.z0], [LF.x1, LF.z0], [LF.x1, LF.z1], [LF.x0, LF.z1]], LF.top, true, 1);
    const zn = LF.z0 - 0.04;
    B.aabb('stainless', lx - 1.0, Y, zn - 0.03, la, Y + 2.3, zn + 0.03); B.aabb('stainless', lb, Y, zn - 0.03, lx + 1.0, Y + 2.3, zn + 0.03); B.aabb('stainless', la, Y + LF.h, zn - 0.03, lb, Y + 2.3, zn + 0.03);
    signQuad(B, signs.cells.lift, lx, Y + 2.75, zn - 0.01, 1.1, 0.42, Math.PI);
    col.addSegment(LF.x0, LF.z0, LF.x0, LF.z1); col.addSegment(LF.x1, LF.z0, LF.x1, LF.z1); col.addSegment(LF.x0, LF.z0, la, LF.z0); col.addSegment(lb, LF.z0, LF.x1, LF.z0);
  }

  // ---------------------------------------------------------------- mezzanine
  const k = INST.k33, e = INST.eig;
  const hex = []; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; hex.push([k.x + k.r * Math.cos(a), k.z + k.r * Math.sin(a)]); }
  const sq = [[e.x - e.s / 2, e.z - e.s / 2], [e.x + e.s / 2, e.z - e.s / 2], [e.x + e.s / 2, e.z + e.s / 2], [e.x - e.s / 2, e.z + e.s / 2]];
  B.flat('floor', [[M.x0, M.z0], [M.x1, M.z0], [M.x1, M.z1], [M.x0, M.z1]], Y, false, 1);
  // carpeted study areas under the crystals
  B.flat('carpet', hex.map(([x, z]) => [k.x + (x - k.x) * 1.5, k.z + (z - k.z) * 1.5]), Y + 0.015, false, 1);
  B.flat('carpet', sq.map(([x, z]) => [e.x + (x - e.x) * 1.45, e.z + (z - e.z) * 1.45]), Y + 0.015, false, 1);
  B.flat('ceiling', [[M.x0, M.z0], [M.x1, M.z0], [M.x1, M.z1], [M.x0, M.z1]], C, true, 1, [hex, sq, [[LF.x0, LF.z0], [LF.x1, LF.z0], [LF.x1, LF.z1 - 0.02], [LF.x0, LF.z1 - 0.02]]]);      // (the lift shaft goes up through it)
  // the part of the mezzanine ceiling under the lobby is the lobby's floor slab: close the stair well's far side
  B.wall('white', M.x0, M.z0, M.x0, M.z1, Y, C, 1, 1);
  B.wall('white', M.x1, M.z1, M.x1, M.z0, Y, C, 1, 1);
  if (SL) {      // (walk-in: Lecture Theatre 1's doorway is a real hole in this wall, lined through its thickness)
    const D1 = INST.l1, dx = INST.doors.L1[0], da = dx - D1.w / 2, db = dx + D1.w / 2, zo = M.z0 - D1.depth;
    B.wall('white', M.x1, M.z0, db, M.z0, Y, C, 1, 1); B.wall('white', da, M.z0, M.x0, M.z0, Y, C, 1, 1); B.wall('white', db, M.z0, da, M.z0, Y + D1.h, C, 1, 1);
    B.wall('white', da, M.z0, da, zo, Y, Y + D1.h, 1, 1); B.wall('white', db, zo, db, M.z0, Y, Y + D1.h, 1, 1);
    B.flat('white', [[da, zo], [db, zo], [db, M.z0], [da, M.z0]], Y + D1.h, true, 1); B.flat('floor', [[da, zo], [db, zo], [db, M.z0], [da, M.z0]], Y + 0.002, false, 1);
  } else B.wall('white', M.x1, M.z0, M.x0, M.z0, Y, C, 1, 1);
  B.wall('white', M.x0, M.z1, S.x0, M.z1, Y, C, 1, 1);
  B.wall('white', S.x1, M.z1, M.x1, M.z1, Y, C, 1, 1);
  B.wall('white', S.x0, M.z1, S.x1, M.z1, Y + 3.7, C, 1, 1);
  col.addSegment(M.x0, M.z0, M.x0, M.z1); col.addSegment(M.x1, M.z0, M.x1, M.z1); col.addSegment(M.x0, M.z0, M.x1, M.z0);
  col.addSegment(M.x0, M.z1, la, M.z1); col.addSegment(lb, M.z1, S.x0, M.z1); col.addSegment(S.x1, M.z1, M.x1, M.z1);
  // timber slat cladding bands on the long walls
  B.wall('slats', M.x0 + 0.03, M.z1 - 0.5, M.x0 + 0.03, M.z0 + 0.5, Y + 2.9, C - 0.1, 1, 1);
  B.wall('slats', M.x1 - 0.03, M.z0 + 0.5, M.x1 - 0.03, M.z1 - 0.5, Y + 2.9, C - 0.1, 1, 1);

  // the crystals: glass + dark steel, rising from the mezzanine ceiling into the atria above (bright light wells)
  const shaftTop = 9.5;
  const shaft = (ring) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      B.wall('white', b[0], b[1], a[0], a[1], C, shaftTop, 1, 1);      // faces inward
      B.wall('slats', b[0], b[1], a[0], a[1], 3.6, 4.6, 1, 1);         // gallery balustrades seen from below
      B.wall('slats', b[0], b[1], a[0], a[1], 7.1, 8.1, 1, 1);
    }
    B.flat('sky', ring, shaftTop, true, 1);
  };
  const out = (ring, c, f) => ring.map(([x, z]) => [c[0] + (x - c[0]) * f, c[1] + (z - c[1]) * f]);
  shaft(out(hex, [k.x, k.z], 1.25)); shaft(out(sq, [e.x, e.z], 1.25));
  // ceiling ring between the opening and the shaft wall
  B.flat('ceiling', out(hex, [k.x, k.z], 1.25), C + 0.02, true, 1, [hex]);
  B.flat('ceiling', out(sq, [e.x, e.z], 1.25), C + 0.02, true, 1, [sq]);
  // K3,3 crystal: hexagonal base whose vertices alternate between two heights (the two vertex classes), the three long
  // diagonals rising to a raised centre; frame = exactly the 9 edges of K3,3 (6 hexagon edges + 3 diagonals)
  {
    const lo = Y + 2.7, top = [k.x, C + 3.4, k.z];
    const v = hex.map(([x, z], i) => [x, i % 2 ? C + 1.3 : C + 0.4, z]);
    for (let i = 0; i < 6; i++) {
      const a = v[i], b = v[(i + 1) % 6];
      B.quad2('glass', [a[0], lo, a[2]], [b[0], lo, b[2]], b, a);            // vertical glass skirt
      B.tri('glass', a, b, top); B.tri('glass', b, a, top);                   // facets
      B.bar('steel', a, b, 0.14);                                             // hexagon edge
      B.bar('steel', [a[0], lo, a[2]], a, 0.1);
      B.bar('steel', [a[0], lo, a[2]], [b[0], lo, b[2]], 0.1);
    }
    for (let i = 0; i < 3; i++) { B.bar('steel', v[i], top, 0.16); B.bar('steel', top, v[i + 3], 0.16); }  // the 3 diagonals
  }
  // eigenfunction crystal: glass surface z = h0 + A sin(2πu) sin(πv) over the square (a Dirichlet eigenfunction of the
  // Laplacian on the square, mode (2,1)); boundary is level, so it sits on vertical glass walls
  {
    const N = 8, h0 = C + 1.6, A = 1.3, x0 = e.x - e.s / 2, z0 = e.z - e.s / 2, lo = Y + 2.7;
    const P = (i, j) => [x0 + (e.s * i) / N, h0 + A * Math.sin((2 * Math.PI * i) / N) * Math.sin((Math.PI * j) / N), z0 + (e.s * j) / N];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      B.tri('glass', a, b, c); B.tri('glass', a, c, d); B.tri('glass', c, b, a); B.tri('glass', d, c, a);
      B.bar('steel', a, b, 0.07); B.bar('steel', a, d, 0.07); B.bar('steel', a, c, 0.05);
    }
    for (let i = 0; i < N; i++) { B.bar('steel', P(i, N), P(i + 1, N), 0.07); B.bar('steel', P(N, i), P(N, i + 1), 0.07); }
    for (const [p, q] of [[[x0, z0], [x0 + e.s, z0]], [[x0 + e.s, z0], [x0 + e.s, z0 + e.s]], [[x0 + e.s, z0 + e.s], [x0, z0 + e.s]], [[x0, z0 + e.s], [x0, z0]]]) {
      B.quad2('glass', [p[0], lo, p[1]], [q[0], lo, q[1]], [q[0], h0, q[1]], [p[0], h0, p[1]]);
      B.bar('steel', [p[0], lo, p[1]], [q[0], lo, q[1]], 0.1);
      B.bar('steel', [p[0], lo, p[1]], [p[0], h0, p[1]], 0.1);
    }
  }
  signQuad(B, signs.cells.north, -5.5, Y + 3.25, M.z0 + 0.05, 2.4, 0.9, 0);
  signQuad(B, signs.cells.south, 5.5, Y + 3.25, M.z0 + 0.05, 2.4, 0.9, 0);

  // study tables + chairs around the crystals (round-ish tables as boxes; chairs low-poly)
  const seats = [];
  const table = (x, z, rot) => {
    B.box('oak', x, Y + 0.72, z, 1.6, 0.05, 0.8, rot); B.box('steel', x, Y + 0.36, z, 0.08, 0.72, 0.08, rot);
    B.box('steel', x, Y + 0.02, z, 0.6, 0.04, 0.6, rot);
    col.addBox(x, z, 1.6, 2.0, rot);      // (the table and its four chairs: the chairs used to be walked through)
    for (const side of [-1, 1]) for (const o of [-0.4, 0.4]) {
      const c = Math.cos(rot), s2 = Math.sin(rot), lx = o, lz = side * 0.75;
      const cx = x + lx * c + lz * s2, cz = z - lx * s2 + lz * c, h = rot + (side > 0 ? Math.PI : 0);
      B.box('chair', cx, Y + 0.45, cz, 0.45, 0.05, 0.45, h); B.box('chair', cx - Math.sin(h) * 0.22, Y + 0.7, cz - Math.cos(h) * 0.22, 0.45, 0.5, 0.04, h);
      B.box('steel', cx, Y + 0.22, cz, 0.04, 0.45, 0.04, h);
      seats.push({ x: cx, z: cz, h });
    }
  };
  for (const [dx, dz, r] of [[-6.2, 0, 0], [6.2, 0, 0], [0, 6.6, Math.PI / 2], [0, -6.6, Math.PI / 2]]) table(k.x + dx, k.z + dz, r);
  for (const [dx, dz, r] of [[-7.4, 0, Math.PI / 2], [7.4, 0, Math.PI / 2], [0, 7.4, 0], [0, -7.4, 0]]) table(e.x + dx, e.z + dz, r);
  // a low square bench under the middle of each crystal (the crystals themselves hang from the ceiling)
  for (const c of [[k.x, k.z], [e.x, e.z]]) { B.aabb('oak', c[0] - 1.2, Y, c[1] - 1.2, c[0] + 1.2, Y + 0.45, c[1] + 1.2); col.addBox(c[0], c[1], 2.4, 2.4); }

  // café (counter, coffee machine, cups, menu)
  const cf = INST.cafe;
  B.aabb('counter', cf.x0, Y, cf.z, cf.x1, Y + 1.05, cf.z + 0.9); B.aabb('oak', cf.x0 - 0.05, Y + 1.05, cf.z - 0.05, cf.x1 + 0.05, Y + 1.11, cf.z + 0.95);
  B.aabb('stainless', cf.x1 - 2.6, Y + 1.11, cf.z + 0.35, cf.x1 - 1.4, Y + 1.65, cf.z + 0.9); B.aabb('dark', cf.x1 - 2.4, Y + 1.25, cf.z + 0.3, cf.x1 - 1.6, Y + 1.32, cf.z + 0.36);
  B.aabb('stainless', cf.x0 + 1, Y + 1.11, cf.z + 0.2, cf.x0 + 2.4, Y + 1.5, cf.z + 0.8);    // pastry cabinet (simplified)
  B.aabb('dark', cf.x0, Y + 1.0, M.z1 - 0.35, cf.x1, Y + 2.4, M.z1 - 0.05);     // back shelving
  signQuad(B, signs.cells.cafe, (cf.x0 + cf.x1) / 2, Y + 3.0, M.z1 - 0.06, 2.6, 0.95, Math.PI);
  signQuad(B, signs.cells.menu, cf.x1 - 1.2, Y + 2.1, M.z1 - 0.4, 1.4, 0.52, Math.PI);
  col.addBox((cf.x0 + cf.x1) / 2, cf.z + 0.45, cf.x1 - cf.x0, 0.9);
  col.addSegment(cf.x0, cf.z, cf.x0, M.z1); col.addSegment(cf.x1, cf.z, cf.x1, M.z1);

  // lecture theatre doors + signs; noticeboards
  const doorAt = (key, x, z) => {
    const onX = Math.abs(Math.abs(x) - M.x1) < 0.01, h = onX ? (x < 0 ? Math.PI / 2 : -Math.PI / 2) : 0;   // facing into the mezzanine
    const nx = Math.sin(h), nz = Math.cos(h), px = x + nx * 0.04, pz = z + nz * 0.04, tx = Math.cos(h), tz = -Math.sin(h);
    if (key === 'L1' && SL) {      // (walk-in: a real doorway — the steel frame only; the leaf is the theatre's fire door)
      const D1 = INST.l1;
      B.box('steel', px, Y + D1.h + 0.05, pz, D1.w + 0.2, 0.1, 0.08, h);
      for (const sd of [-1, 1]) B.box('steel', px + tx * sd * (D1.w / 2 + 0.05), Y + D1.h / 2, pz + tz * sd * (D1.w / 2 + 0.05), 0.1, D1.h, 0.08, h);
      signQuad(B, signs.cells[key], px + nx * 0.02, Y + 2.85, pz + nz * 0.02, 0.9, 0.34, h);
      return;
    }
    const w = key === 'L1' || key === 'L2' || key === 'L3' ? 2.4 : 1.8;
    // oak leaves in a steel frame, with vision panels
    B.box('oak', px, Y + 1.15, pz, w, 2.3, 0.06, h);
    B.box('steel', px, Y + 2.35, pz, w + 0.2, 0.1, 0.08, h);
    B.box('steel', px + tx * (w / 2 + 0.05), Y + 1.2, pz + tz * (w / 2 + 0.05), 0.1, 2.4, 0.08, h);
    B.box('steel', px - tx * (w / 2 + 0.05), Y + 1.2, pz - tz * (w / 2 + 0.05), 0.1, 2.4, 0.08, h);
    B.box('dark', px, Y + 1.15, pz, 0.02, 2.3, 0.07, h);
    for (const sd of [-1, 1]) B.box('glassRoof', px + tx * sd * w * 0.25 + nx * 0.02, Y + 1.5, pz + tz * sd * w * 0.25 + nz * 0.02, 0.18, 0.7, 0.02, h);
    B.box('stainless', px + tx * 0.15 + nx * 0.06, Y + 1.05, pz + tz * 0.15 + nz * 0.06, 0.03, 0.5, 0.03, h);
    signQuad(B, signs.cells[key], px + nx * 0.02, Y + 2.85, pz + nz * 0.02, 0.9, 0.34, h);
  };
  for (const [key, [x, z]] of Object.entries(INST.doors)) doorAt(key, x, z);
  signQuad(B, signs.cells.class, M.x1 - 0.05, Y + 2.8, -6, 1.3, 0.48, -Math.PI / 2);
  signQuad(B, signs.cells.theatres, 0, Y + 3.3, M.z1 - 0.06, 2.4, 0.9, Math.PI);
  signQuad(B, signs.cells.exit, 0, 3.1, L.z1 - 0.12, 1.6, 0.6, Math.PI);
  const nbMats = [std({ map: noticeboardTex(POSTERS_A, 5), roughness: 0.9 }), std({ map: noticeboardTex(POSTERS_B, 9), roughness: 0.9 })];
  const nb = (m, x, z, h) => {
    const g = new THREE.PlaneGeometry(4.2, 1.97); const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x + Math.sin(h) * 0.05, Y + 1.6, z + Math.cos(h) * 0.05); mesh.rotation.y = h; s.add(mesh);
    B.box('oak', x, Y + 1.6, z, 4.36, 2.1, 0.04, h);
  };
  nb(nbMats[0], -5.5, M.z0 + 0.02, 0); nb(nbMats[1], 5.5, M.z0 + 0.02, 0);

  // ---------------------------------------------------------------- lights (4 + the scene's ambient + hemisphere = 6)
  const pl = (x, y, z, c, i, d) => { const l = new THREE.PointLight(c, i, d, 1.4); l.position.set(x, y, z); s.add(l); return l; };
  pl(k.x, Y + 2.2, k.z, 0xeef4ff, 60, 26); pl(e.x, Y + 2.2, e.z, 0xeef4ff, 60, 26);
  pl(14, Y + 2.8, -2, 0xffe2b8, 14, 12); pl(0, 6, 16, 0xffffff, 30, 30);

  const meshes = B.build({ ...mats, default: mats.white }, s);
  for (const m of meshes) if (m.material === mats.glass) m.renderOrder = 2;
  // the lift: the car and the two landing doors (a through car: the lobby's door in the south end of the shaft, the
  // mezzanine's in the north end). No prompt, no fade: you walk in and are carried.
  let lift = null;
  if (ctx.addDoor) {
    try { lift = makeLift(ctx, game, { place: ctx.id, x0: LF.x0, x1: LF.x1, z0: LF.z0, z1: LF.z1, levels: [Y, 0], ends: ['z0', 'z1'], doorW: LF.w, doorH: LF.h, start: 1, carH: 2.3,
      mats: { wall: mats.liftSteel, floor: mats.rubber, light: mats.sky, rail: mats.steel, leaf: mats.liftSteel, frame: mats.steel } }); } catch (e) { console.error('[maths] lift', e); }
  }
  return { seats, meshes, tris: B.tris(), signs, lift, mats };
}

/** a flat sign quad using an atlas cell, centred at (x, y, z), facing heading h */
export function signQuad(B, cell, x, y, z, w, hgt, h) {
  const c = Math.cos(h), s = Math.sin(h), hw = w / 2, hh = hgt / 2;
  const P = (lx, ly) => [x + lx * c, y + ly, z - lx * s];
  const [u0, v0, u1, v1] = cell;
  B.quad('signs', P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh), [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
}

// ------------------------------------------------------------------------------------------------ Lecture Theatre 1
// Local frame: boards on the front wall at z = 0; seats rise towards the back (+z); entrance at the top/back (z = 22),
// level with the mezzanine (y = 0). 14 rows × (8 + 10 + 8) = 364 seats (the AV installer's figure is 363).
export const LT = {
  W: 9.6, back: 22, frontY: -4.9, rowZ0: 6.4, rowD: 0.95, rows: 14, rise: 0.33, walkZ: 19.7,
  blocks: [[-8.35, -3.95, 8], [-2.75, 2.75, 10], [3.95, 8.35, 8]], aisles: [-3.35, 3.35], pitch: 0.55,
  cols: [-5.2, -1.75, 1.75, 5.2], boardW: 3.33, boardH: 1.3, lowY: 1.0, highY: 2.42,
  door: { w: INST.l1.w, h: INST.l1.h, depth: INST.l1.depth },      // the doorway in the back wall (walk-in: off the mezzanine)
};
export const rowFloor = (r) => LT.frontY + 0.3 + r * LT.rise;
export function theatreGround(x, z) {
  if (z >= LT.walkZ) return 0;
  if (z < LT.rowZ0) return LT.frontY;
  const u = (z - LT.rowZ0) / LT.rowD, r = Math.min(LT.rows - 1, Math.floor(u));
  const inAisle = LT.aisles.some((a) => Math.abs(x - a) < 0.6) || Math.abs(x) > 8.35;
  if (inAisle && u - r < 0.5) return rowFloor(r) - LT.rise / 2;
  return rowFloor(r);
}
/** seat positions: [{x, z, y, row, block, i, aisleSide}] */
export function theatreSeats() {
  const out = [];
  for (let r = 0; r < LT.rows; r++) LT.blocks.forEach(([x0, x1, n], b) => {
    for (let i = 0; i < n; i++) out.push({ x: x0 + LT.pitch * (i + 0.5), z: LT.rowZ0 + LT.rowD * r + 0.7, y: rowFloor(r), row: r, block: b, i, n });
  });
  return out;
}

export function buildTheatre(ctx, game, walkin = false) {
  const s = ctx.scene, col = ctx.collider, B = new Batch();
  const W = LT.W, FY = LT.frontY;
  const mats = {
    floor: std({ map: tex(noiseTex('#5a5e63', 0.1, 31), 1 / 2, 1 / 2), roughness: 1 }),
    front: std({ map: tex(noiseTex('#b8b6b0', 0.06, 7), 1 / 3, 1 / 3), roughness: 0.5 }),
    white: std({ color: 0xeceae5, roughness: 0.95 }),
    slats: std({ map: tex(slatsTex(), 1 / 2.4, 1 / 0.6), roughness: 0.7 }),
    ceiling: std({ color: 0x3a3c40, roughness: 1 }),
    desk: std({ color: 0xc9a77a, roughness: 0.6 }),
    steel: std({ color: 0x2b2f33, roughness: 0.45, metalness: 0.6 }),
    oak: std({ color: 0xb98a55, roughness: 0.6 }),
    dark: std({ color: 0x1b1c1e, roughness: 0.8 }),
    light: new THREE.MeshBasicMaterial({ color: 0xfff8ea }),
  };
  // floors
  B.flat('front', [[-W, 0], [W, 0], [W, LT.rowZ0], [-W, LT.rowZ0]], FY, false, 1);
  B.flat('floor', [[-W, LT.walkZ], [W, LT.walkZ], [W, LT.back], [-W, LT.back]], 0, false, 1);
  for (let r = 0; r < LT.rows; r++) {
    const z0 = LT.rowZ0 + r * LT.rowD, z1 = z0 + LT.rowD, y = rowFloor(r), yPrev = r ? rowFloor(r - 1) : FY;
    B.flat('floor', [[-W, z0], [W, z0], [W, z1], [-W, z1]], y, false, 1);
    B.wall('floor', W, z0, -W, z0, yPrev, y, 1, 1);
    // aisle half-steps
    for (const a of [...LT.aisles, -8.98, 8.98]) {
      const hw = Math.abs(a) > 8 ? 0.62 : 0.6;
      B.aabb('floor', a - hw, y - LT.rise / 2, z0, a + hw, y - LT.rise / 2 + 0.002, z0 + LT.rowD / 2);
      B.aabb('steel', a - hw, y - LT.rise / 2, z0 + LT.rowD / 2 - 0.03, a + hw, y, z0 + LT.rowD / 2);
    }
  }
  B.wall('floor', W, LT.walkZ, -W, LT.walkZ, rowFloor(LT.rows - 1), 0, 1, 1);
  // walls: timber-slat acoustic panels on the sides, white elsewhere; dark ceiling with light strips
  B.wall('white', -W, LT.back, -W, 0, FY, 3.4, 1, 1); B.wall('white', W, 0, W, LT.back, FY, 3.4, 1, 1);
  B.wall('slats', -W + 0.04, LT.back - 1, -W + 0.04, 1, FY + 2.5, 3.0, 1, 1); B.wall('slats', W - 0.04, 1, W - 0.04, LT.back - 1, FY + 2.5, 3.0, 1, 1);
  const DR = LT.door, dh = DR.w / 2;
  if (walkin) {      // the doorway left open in the back wall, a steel frame round it
    B.wall('white', W, LT.back, dh, LT.back, 0, 3.4, 1, 1); B.wall('white', -dh, LT.back, -W, LT.back, 0, 3.4, 1, 1); B.wall('white', dh, LT.back, -dh, LT.back, DR.h, 3.4, 1, 1);
    B.aabb('steel', -dh - 0.1, DR.h, LT.back - 0.06, dh + 0.1, DR.h + 0.1, LT.back); for (const sd of [-1, 1]) B.aabb('steel', sd * dh, 0, LT.back - 0.06, sd * (dh + 0.1), DR.h, LT.back);
  } else B.wall('white', W, LT.back, -W, LT.back, 0, 3.4, 1, 1);
  B.wall('white', -W, 0, W, 0, FY, 3.4, 1, 1);
  B.flat('ceiling', [[-W, 0], [W, 0], [W, LT.back], [-W, LT.back]], 3.4, true, 1);
  for (let z = 3; z < LT.back; z += 3.2) B.aabb('light', -6, 3.36, z, 6, 3.38, z + 0.25);
  col.addSegment(-W, 0, -W, LT.back); col.addSegment(W, 0, W, LT.back); col.addSegment(-W, 0, W, 0); col.addSegment(-W, LT.back, W, LT.back);
  // seating blocks collide (walk in the aisles; sit with [E])
  for (const [x0, x1] of LT.blocks) col.addPolygon([[x0, LT.rowZ0 + 0.05], [x1, LT.rowZ0 + 0.05], [x1, LT.walkZ - 0.02], [x0, LT.walkZ - 0.02]]);
  // continuous desks in front of each row (on the back of the row in front), with modesty panels
  for (let r = 0; r < LT.rows; r++) for (const [x0, x1] of LT.blocks) {
    const z = LT.rowZ0 + r * LT.rowD + 0.08, y = rowFloor(r);
    B.aabb('desk', x0, y + 0.72, z, x1, y + 0.76, z + 0.36);
    B.aabb('oak', x0, y, z - 0.02, x1, y + 0.72, z + 0.02);
  }
  // lecturer's bench, lectern, chalk trays, door
  B.aabb('oak', -3, FY, 2.4, 3, FY + 0.95, 3.3); B.aabb('desk', -3.05, FY + 0.95, 2.35, 3.05, FY + 1.0, 3.35);
  B.aabb('dark', 2.0, FY + 1.0, 2.6, 2.7, FY + 1.42, 3.1);   // visualiser
  B.aabb('dark', -1.6, FY + 1.0, 2.6, -1.1, FY + 1.02, 2.9); // laptop base
  col.addBox(0, 2.85, 6.1, 1.0);
  for (const x of LT.cols) B.aabb('steel', x - LT.boardW / 2 - 0.08, FY + LT.lowY - 0.08, 0.02, x + LT.boardW / 2 + 0.08, FY + LT.lowY - 0.02, 0.16);
  // board column frames (the boards themselves are dynamic, see _maths_lecture.js)
  for (const x of LT.cols) {
    B.aabb('steel', x - LT.boardW / 2 - 0.1, FY + 0.85, 0.01, x - LT.boardW / 2 - 0.02, FY + LT.highY + LT.boardH + 0.12, 0.12);
    B.aabb('steel', x + LT.boardW / 2 + 0.02, FY + 0.85, 0.01, x + LT.boardW / 2 + 0.1, FY + LT.highY + LT.boardH + 0.12, 0.12);
  }
  // projector screen box (rolled) on the right, and the projector
  B.aabb('white', 3.6, 1.55, 0.05, 8.4, 1.75, 0.3);
  B.aabb('dark', -0.4, 3.0, 11, 0.4, 3.35, 11.8);
  // exit door at the back
  if (!walkin) B.aabb('oak', -1.2, 0, LT.back - 0.06, 1.2, 2.3, LT.back - 0.02);
  // lights: 3 (+ ambient + hemisphere = 5)
  const sp = new THREE.SpotLight(0xffffff, 120, 30, 0.7, 0.5, 1.2); sp.position.set(0, 2.8, 9); sp.target.position.set(0, FY + 2, 0); s.add(sp, sp.target);
  const p1 = new THREE.PointLight(0xfff2dc, 40, 26, 1.2); p1.position.set(0, 2.6, 13); s.add(p1);
  const p2 = new THREE.PointLight(0xfff2dc, 18, 16, 1.2); p2.position.set(0, 1.4, 4); s.add(p2);
  const meshes = B.build({ ...mats, default: mats.white }, s);
  // the door: a veneered fire door on a closer, hung on the east jamb, opening into the theatre (it shuts behind you; no
  // glass in it: shut, the mezzanine is not drawn from in here, nor the theatre from out there)
  let door = null;
  if (walkin && ctx.addDoor) door = ctx.addDoor({ kind: 'hinged', style: 'fire', at: [dh, LT.back + 0.12], y: 0, w: DR.w, h: DR.h - 0.02, dir: -Math.PI / 2, swing: -1, closer: true, thick: 0.05,
    mats: { leaf: mats.oak, handle: mats.steel, plate: mats.steel }, portal: 0 });
  return { meshes, tris: B.tris(), door };
}
