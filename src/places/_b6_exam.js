// The Examination Schools' North School as a walk-in (batch 6) and the "sit an exam" gag — see
// docs/research/landmarks_batch6.md. Pure logic first (node-tested by tools/smoke_batch6.mjs), then the room's
// contents as ONE vertex-coloured merged mesh (desks, chairs, the invigilator's table, the clock, the panelling).
// The paper is a pure function of the game day; marking is deterministic; nothing is sent over the network.
import * as THREE from 'three';

export const ROOM = { w: 18, d: 30, h: 10 };
export const DESKS = { cols: 6, rows: 9, dx: 2.4, dz: 2.6, z0: -9.5 };
/** the desk the player may sit at (the others are taken or reserved): front row seats are for the invigilator's eye */
export const FREE = [[2, 5], [3, 5], [1, 6], [4, 6]];
export const deskPos = (c, r) => [(c - (DESKS.cols - 1) / 2) * DESKS.dx, DESKS.z0 + r * DESKS.dz];
// The walk-in North School (high_street.js; core/interiors.js "seamless"): the Schools' front block on the High is 40 m
// long but only 12 m deep, so the room lies ALONG the front — 11 m across, 30 m long, the street door in the middle
// of its long (east-in-room-coordinates) wall, four desks abreast instead of six, the dais at one end as before.
export const ROOM_SL = { w: 11, d: 30, h: 10 };
export const DESKS_SL = { cols: 4, rows: 9, dx: 2.4, dz: 2.6, z0: -9.5 };
export const FREE_SL = [[1, 5], [2, 5], [0, 6], [3, 6]];
export const deskPosSL = (c, r) => [(c - (DESKS_SL.cols - 1) / 2) * DESKS_SL.dx, DESKS_SL.z0 + r * DESKS_SL.dz];

/** every question: q, three answers, the index the examiners want (any likeness to a real paper is accidental) */
export const QUESTIONS = [
  ['How many punts fit under Magdalen Bridge at once?', ['Several, briefly', 'One, sideways', 'It depends on the punter'], 2],
  ['Discuss: "The Radcliffe Camera takes no photographs."', ['True', 'False', 'It is a reading room'], 2],
  ['Which way round the quad do Merton fellows walk when the clocks go back?', ['Backwards', 'Forwards', 'They take a taxi'], 0],
  ['What is the correct response to a porter saying "Can I help you?"', ['"Yes, thank you"', 'Leave the grass', 'Show your card'], 1],
  ['Name the river at Folly Bridge.', ['The Isis', 'The Thames', 'Both, depending who you ask'], 2],
  ['The Bridge of Sighs joins which two things?', ['Two halves of Hertford', 'Venice and Oxford', 'Lunch and dinner'], 0],
  ['How long is a "short" Oxford term?', ['Eight weeks', 'Eight weeks, but they feel like four', 'Ask your tutor'], 0],
  ['Estimate the number of bicycles in Oxford.', ['More than people', 'Exactly one per person', 'All of them, at the station'], 0],
  ['What does a "sub fusc" consist of?', ['A dark suit, white shirt, gown', 'A submarine', 'Fusc, and below it more fusc'], 0],
  ['Where may you not walk in most colleges?', ['On the grass', 'In the library', 'Backwards'], 0],
  ['Which carnation does a candidate wear to the first paper?', ['Red', 'White, then pink, then red', 'Blue'], 1],
  ['Which is longer?', ['The High', 'Broad Street', 'A viva'], 2],
];
export const PAPER_LEN = 3, EXAM_SECS = 45;
/** the day's paper: three distinct questions, a pure function of the game day */
export function paper(day) {
  const n = QUESTIONS.length, out = []; let k = ((day * 7 + 3) % n + n) % n;
  while (out.length < PAPER_LEN) { if (!out.includes(k)) out.push(k); k = (k + 5) % n; }
  return out;
}
/** marks -> the class ("First", "Upper Second", "Lower Second", "Third"); time out with nothing written -> "Fail" */
export function classOf(right, answered) {
  if (!answered) return 'Fail';
  return right >= 3 ? 'First' : right === 2 ? 'Upper Second' : right === 1 ? 'Lower Second' : 'Third';
}
export function mark(day, answers) {
  const p = paper(day); let right = 0, answered = 0;
  p.forEach((qi, i) => { const a = answers[i]; if (a == null) return; answered++; if (a === QUESTIONS[qi][2]) right++; });
  return { right, answered, cls: classOf(right, answered), paper: p };
}
export const INVIGILATOR = [
  'The invigilator: "You may turn over your papers. You may begin."',
  'The invigilator: "Thirty minutes remaining." (It has been about forty seconds.)',
  'The invigilator: "Eyes on your own paper, please."',
  'The invigilator: "Pens down. Pens DOWN. Thank you."',
];

// ---------------------------------------------------------------------------------------------- the room's contents
/** -> {geo, solids: [[x, z, w, d]]} : panelling, the dais, desks and chairs, the clock, the coved ceiling's ribs */
/** o (walk-in): { room, desks, deskPos, gaps: [[z0, z1, sill, head]] = openings in the +x wall (door: sill 0) } */
export function contents(o = {}) {
  const pos = [], nor = [], col = [], solids = [];
  const C = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const box = (x, y, z, w, h, d, c, ry = 0) => {
    const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z);
    const p = g.toNonIndexed(), P = p.attributes.position.array, Nn = p.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) { pos.push(P[i], P[i + 1], P[i + 2]); nor.push(Nn[i], Nn[i + 1], Nn[i + 2]); const k = 0.82 + 0.18 * Math.max(0, Nn[i + 1]); col.push(c[0] * k, c[1] * k, c[2] * k); }
    g.dispose(); p.dispose();
  };
  const oak = C(0x6b4a2e), oakDk = C(0x3e2a1a), paper = C(0xf0ece0), iron = C(0x26262a), stone = C(0xcfc2a2), green = C(0x2f4a38), white = C(0xf4f1ea);
  const { w: W, d: D, h: H } = o.room || ROOM, DK = o.desks || DESKS, dPos = o.deskPos || deskPos;
  // panelling dado round the walls (3.4 m), a cornice, the coved ceiling's ribs across
  for (const sx of [-1, 1]) {
    if (sx > 0 && o.gaps) {      // the wall with the street door and the great windows: the dado between and under them
      let z = -D / 2 + 0.1; const gs = [...o.gaps].sort((p, q) => p[0] - q[0]);
      const run = (a, b2) => { if (b2 - a < 0.05) return; box(W / 2 - 0.08, 1.7, (a + b2) / 2, 0.12, 3.4, b2 - a, oak); box(W / 2 - 0.14, 3.45, (a + b2) / 2, 0.2, 0.14, b2 - a, oakDk); };
      for (const [g0, g1, sill, head] of gs) { run(z, g0); if (sill > 0.05) box(W / 2 - 0.08, sill / 2, (g0 + g1) / 2, 0.12, sill, g1 - g0, oak); if (head < 3.4) box(W / 2 - 0.08, (head + 3.4) / 2, (g0 + g1) / 2, 0.12, 3.4 - head, g1 - g0, oak); z = g1; }
      run(z, D / 2 - 0.1);
      continue;
    }
    box(sx * (W / 2 - 0.08), 1.7, 0, 0.12, 3.4, D - 0.2, oak); box(sx * (W / 2 - 0.14), 3.45, 0, 0.2, 0.14, D - 0.2, oakDk);
  }
  box(0, 1.7, -D / 2 + 0.08, W - 0.2, 3.4, 0.12, oak); box(0, 1.7, D / 2 - 0.08, W - 0.2, 3.4, 0.12, oak);
  for (let z = -D / 2 + 2; z < D / 2; z += 4) box(0, H - 0.25, z, W - 0.4, 0.3, 0.35, stone);
  // the dais and the invigilator's table at the north end, the clock over it
  box(0, 0.15, -D / 2 + 2.2, 8, 0.3, 3.6, oakDk); solids.push([0, -D / 2 + 2.2, 8, 3.6]);
  box(0, 1.05, -D / 2 + 2.0, 3.0, 0.08, 1.1, oak); box(0, 0.65, -D / 2 + 2.0, 2.8, 0.75, 0.9, oakDk); solids.push([0, -D / 2 + 2.0, 3.2, 1.3]);
  box(0, 6.0, -D / 2 + 0.2, 1.3, 1.3, 0.12, white); box(0, 6.0, -D / 2 + 0.28, 0.05, 0.5, 0.04, iron); box(0.18, 6.05, -D / 2 + 0.28, 0.4, 0.05, 0.04, iron);
  box(0, 6.0, -D / 2 + 0.16, 1.45, 1.45, 0.08, oakDk);
  // the desks: small single desks in rows, each with a chair, a paper and an answer booklet
  for (let r = 0; r < DK.rows; r++) for (let c = 0; c < DK.cols; c++) {
    const [x, z] = dPos(c, r);
    box(x, 0.74, z, 1.0, 0.05, 0.62, oak);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(x + sx * 0.45, 0.37, z + sz * 0.26, 0.04, 0.72, 0.04, iron);
    box(x - 0.15, 0.775, z + 0.02, 0.3, 0.01, 0.42, paper); box(x + 0.2, 0.775, z + 0.05, 0.24, 0.012, 0.34, green);
    box(x, 0.45, z + 0.55, 0.42, 0.04, 0.4, oakDk); box(x, 0.72, z + 0.74, 0.42, 0.5, 0.04, oakDk);
    for (const sx of [-1, 1]) for (const sz of [0.37, 0.72]) box(x + sx * 0.18, 0.22, z + sz, 0.03, 0.45, 0.03, iron);
    solids.push([x, z + 0.225, 1.0, 1.08]);      // (the whole desk and its chair: the chair's back half and the desk's front edge used to be walked through)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return { geo: g, solids };
}

/**
 * Window glass as it is seen from OUTSIDE: one dark, part-transparent pane per opening, facing out only (from inside
 * it is not there and the view out is clear). A lit room behind plain openings is as bright as a lamp from the street
 * by day; behind this it reads as glass — dark by day, glowing when the lights are on at night.
 *   ops: [{ at, out, w, y0, y1, depth }] (room coordinates)   -> THREE.Mesh (room scene)
 */
export function outsideTint(ops, { opacity = 0.5, color = 0x18222b, inset = 0.5 } = {}) {
  const P = [];
  for (const o of ops) {
    const dx = Math.sin(o.out), dz = Math.cos(o.out), tx = Math.cos(o.out), tz = -Math.sin(o.out), k = (o.depth ?? 0.3) * inset, hw = o.w / 2;
    const pt = (s, y) => [o.at[0] + tx * s + dx * k, y, o.at[1] + tz * s + dz * k];
    const a = pt(-hw, o.y0), b = pt(hw, o.y0), c = pt(hw, o.y1), d = pt(-hw, o.y1);
    // (wound so that the front face looks along `out`)
    const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), 0, (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    const tri = n[0] * dx + n[2] * dz > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const v of tri) P.push(v[0], v[1], v[2]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.FrontSide, name: 'wc:win-glass-tint' }));
  m.name = 'wc:win-glass-tint'; m.renderOrder = 3; m.matrixAutoUpdate = false; m.userData.live = true; return m;
}
