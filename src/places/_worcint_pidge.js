// The pigeonhole room ("the pidge room"), Pump Quad. Research: the college's student handbook lists the student post
// room in Pump Quad, Staircase 15 (a visitor sheet says 16); nothing found on what it looks like inside, so the room
// is a GUESS: a plain ground-floor room in the Staircase 15 range with timber pigeonhole racks on two walls (holes in
// alphabetical order of surname, divider letters on the cornice, a name slip under each hole — surname initials only,
// the game's friends by first name), a cork noticeboard, a parcel shelf, a recycling bin full of flyers, worn lino,
// fluorescent strip lights, a radiator under a sash window onto the quad.
// Frame: x -3..3 (west..east), z -5.2 (north, the far rack) .. 0 (south wall = the Pump Quad front: door + window).
// Draws: one mesh per material after mergeStatic (~20) + the player's own post (one small mesh, hidden once taken).
import * as THREE from 'three';
import { Batch, frame, rectPts, sharedMats, buildBatch, addPoint, ambientOf, mergeStatic, sash, skyGlass, wallShade, woodGrain } from './_worcint_kit.js';
import { canvas, tex, rng } from './_worcint_tex.js';
import { PIDGE_SLOTS, PIDGE_FRIENDS, surnameLetters } from './_worcint_logic.js';
import { PUMPR_ON, RANGE_OPENINGS as RO } from './_worcester_pumpranges_plan.js';

// (walk-in room, in place behind the Staircase 15 front: the window is where the front has room for it beyond the
//  staircase's own door, whose inside face — locked — is on this wall too: `stair`; WALL = the front wall's thickness)
// win: the glass of the range's own ground-floor sash east of Staircase 15's door (generic facade of OSM w301621503:
// bay centre 2.08 m east of the room's middle, 1.08 m wide, 0.94..3.28 above the quad = 0.84..3.18 above this floor):
// the room's window is punched exactly there, so the outside shows that one sash and nothing else. H rose from 3.0 for it.
export const PR = { X0: -3, X1: 3, Z0: -5.2, Z1: 0, H: 3.3, WALL: 0.28, door: { x: 1.7, w: 1.0, h: 2.2 }, win: { x: -2.08, w: 1.08, y0: 0.84, y1: 3.18 }, stair: { x: -0.5, w: 0.9, h: 2.1 } };
// 2026-11-23, THE HAND-BUILT FRONT (places/worcester_pumpranges.js; `?wpumpr=0` = the generator's front, as above): the
// range's court front is real masonry with a doorway and a sash cut in it (RANGE_OPENINGS in
// _worcester_pumpranges_plan.js). The room is refitted to them:
//  - win: the front's six-over-six sash at u 17.76 (the college's photograph of the court's corner has that sash 2.1 m
//    from the canted angle), 0.95 m wide, 0.55 .. 2.35 m above the court = 0.45 .. 2.25 above this floor (a 10 cm step up);
//  - win2: the front's second sash onto the court, the wide eight-over-eight at u 15.5 (the same photograph);
//  - punch: how far in from the front's OUTER face the doorway and the window are punched: 7 cm in front of the door
//    and the sash the front paints at the back of its stone reveals (the scheme of _worcint_hall_plan.js PUNCH). The
//    room draws nothing outward of that plane: the reveals out there are the front's own stone;
//  - leaf / glass: the room's own door leaf and sash stand just behind where the front paints its;
//  - stair: gone. The door "to Staircase 15" on this wall led to a painted door outside that the real front does not
//    have (the 1939 plan and the photograph: plain wall between this room's door and its window; Staircase 15's door
//    is the angle doorway).
if (PUMPR_ON) {
  const fl = RO.door.y0;      // the room's floor above the court
  PR.door = { x: 1.7, w: RO.door.w, h: +(RO.door.y1 - fl).toFixed(4) };
  PR.win = { x: -2.08, w: RO.win.w, y0: +(RO.win.y0 - fl).toFixed(4), y1: +(RO.win.y1 - fl).toFixed(4) };
  PR.win2 = { x: +(1.7 - 1.5).toFixed(4), w: RO.win2.w, y0: +(RO.win2.y0 - fl).toFixed(4), y1: +(RO.win2.y1 - fl).toFixed(4) };      // the front's wide eight-over-eight sash between the door and the first window
  PR.punch = { door: +(RO.door.recess - 0.07).toFixed(4), win: +(RO.win.recess - 0.07).toFixed(4) };
  PR.leaf = +(PR.WALL - RO.door.recess - 0.055).toFixed(4);      // the leaf's plane, out from the room's wall face (its outer face 3 cm behind the paint)
  PR.glass = +(PR.WALL - RO.win.recess - 0.03).toFixed(4);
  PR.stair = null;
}
// racks: [frame origin x, z, along ax, az, length, columns]; rows / heights shared
const RK = { y0: 0.38, y1: 2.18, rows: 8, depth: 0.34 };
const RACKS = [
  { key: 'west', o: [PR.X0, -1.1], a: [0, -1], L: 3.76, cols: 14 },
  { key: 'north', o: [-2.66, PR.Z0], a: [1, 0], L: 5.36, cols: 20 },
];
export const OWN = { rack: 1, col: 11, row: 4 };   // your pigeonhole: far wall, chest height, right of centre

// ------------------------------------------------------------------------------------------------ paper atlas
// 1024²: name slips + divider headers (64×20 slots, 16 a row, rows 0..24), post cells (8×4 of 128×96 from y 512),
// small signs (y 896..1024).
const AW = 1024;
const uvR = (x, y, w, h) => [(x + 1) / AW, 1 - (y + h - 1) / AW, (x + w - 1) / AW, 1 - (y + 1) / AW];
const slot = (i) => [(i % 16) * 64, Math.floor(i / 16) * 20];
const postCell = (i) => [(i % 8) * 128, 512 + Math.floor(i / 8) * 96];
const SIGNS = { fire: [0, 896, 192, 64], parcels: [192, 896, 256, 64], members: [448, 896, 320, 64], recycle: [768, 896, 128, 64], plate: [896, 896, 128, 64] };
const N_POST = 24;

function scribble(g, x, y, w, R, col = '#2a2a3a', lw = 1.4) {
  g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y);
  let px = x; while (px < x + w) { const nx = px + 3 + R() * 5; g.quadraticCurveTo((px + nx) / 2, y - 3 - R() * 4, nx, y + (R() - 0.5) * 2); px = nx; }
  g.stroke();
}
function lines(g, x, y, w, n, gap, R, col = '#555', h = 2) { g.fillStyle = col; for (let k = 0; k < n; k++) g.fillRect(x, y + k * gap, w * (0.55 + R() * 0.45), h); }
function txt(g, t, x, y, size, col, font = 'Arial, sans-serif', weight = 'bold', align = 'center') { g.fillStyle = col; g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x, y); }

function drawCard(g, i, text, kind) {
  const [x, y] = slot(i);
  g.clearRect(x, y, 64, 20);
  g.fillStyle = kind === 'header' ? '#1e1a14' : kind === 'blank' ? '#efe9d8' : '#f6f0de'; g.fillRect(x, y, 64, 20);
  if (kind === 'header') { g.fillStyle = '#c9a54a'; g.fillRect(x + 2, y + 2, 60, 1); g.fillRect(x + 2, y + 17, 60, 1); txt(g, text, x + 32, y + 10.5, 13, '#eadfbe', 'Georgia, serif'); return; }
  g.strokeStyle = 'rgba(60,50,30,0.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, 63, 19);
  if (kind === 'blank') return;
  if (kind === 'name' || kind === 'own') { txt(g, text.slice(0, 11), x + 32, y + 10.5, text.length > 8 ? 10 : 12, kind === 'own' ? '#7a1010' : '#141414', 'Arial, sans-serif'); if (kind === 'own') { g.fillStyle = 'rgba(160,20,20,0.6)'; g.fillRect(x + 4, y + 16, 56, 1.5); } return; }
  // a surname initial and a typed-looking line (no names)
  const R = rng(500 + i);
  txt(g, text, x + 9, y + 10.5, 12, '#141414', 'Arial, sans-serif', 'bold');
  g.fillStyle = 'rgba(30,30,30,0.75)'; const w = 18 + R() * 28; g.fillRect(x + 17, y + 9, w, 2.2); if (R() < 0.5) g.fillRect(x + 20 + w, y + 9, 6 + R() * 6, 2.2);
}

function drawPost(g, i) {
  const [x, y] = postCell(i), w = 128, h = 96, R = rng(900 + i);
  g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip();
  const env = (bg, ink = '#20203a') => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w / 2, h * 0.45); g.lineTo(w, 0); g.fill();
    g.fillStyle = ['#c83a3a', '#3a6ac8', '#8a3ab0', '#d8a020'][Math.floor(R() * 4)]; g.fillRect(w - 26, 6, 18, 22);   // stamp
    g.strokeStyle = 'rgba(40,40,40,0.5)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(w - 48, 10 + k * 4); g.quadraticCurveTo(w - 36, 6 + k * 4, w - 22, 12 + k * 4); g.stroke(); }
    for (let k = 0; k < 4; k++) scribble(g, 30 + R() * 10, 44 + k * 11, 50 + R() * 30, R, ink);
  };
  switch (i) {
    case 0: case 1: case 2: case 3: env(['#fbfaf4', '#f2efe4', '#fffef8', '#eef0f2'][i]); break;
    case 4: env('#d9b98a', '#2a1a10'); g.fillStyle = '#2a1a10'; g.fillRect(10, 10, 46, 3); txt(g, 'INTERNAL', 34, 22, 10, '#3a2a18'); break;   // manila
    case 5: env('#cfae7e', '#2a1a10'); txt(g, 'UNIVERSITY MAIL', 52, 16, 9, '#3a2a18'); break;
    case 6: g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, w, h); for (let k = 0; k < 26; k++) { g.fillStyle = k % 2 ? '#c8282a' : '#2a3ab0'; g.save(); g.translate(k * 10, 0); g.transform(1, 0, 0.6, 1, 0, 0); g.fillRect(0, 0, 5, 5); g.fillRect(0, h - 5, 5, 5); g.restore(); } txt(g, 'PAR AVION', 30, 20, 9, '#2a3ab0'); for (let k = 0; k < 3; k++) scribble(g, 32, 50 + k * 12, 60, R); break;   // airmail
    case 7: env('#b8202a', '#f4e8c8'); break;   // a card (red envelope)
    case 8: env('#d8c8e8'); break;
    case 9: g.fillStyle = '#f2a8c0'; g.fillRect(0, 0, w, h); txt(g, 'PARCEL', w / 2, 20, 20, '#5a1020'); txt(g, 'waiting at the Lodge', w / 2, 42, 11, '#5a1020', 'Arial, sans-serif', 'normal'); g.fillStyle = '#5a1020'; g.fillRect(14, 60, 100, 1); g.fillRect(14, 76, 100, 1); scribble(g, 18, 58, 50, R, '#202040'); break;
    case 10: g.fillStyle = '#f4e050'; g.fillRect(0, 0, w, h); txt(g, 'RECALL', w / 2, 18, 20, '#202020'); txt(g, 'College Library', w / 2, 36, 10, '#202020', 'Arial', 'normal'); lines(g, 12, 50, 104, 4, 9, R, '#333'); break;
    case 11: g.fillStyle = '#ff3c9a'; g.fillRect(0, 0, w, h); txt(g, 'BOP', w / 2, 34, 40, '#fff04a', 'Impact, Arial Black, sans-serif'); txt(g, 'FRIDAY · CELLAR BAR', w / 2, 64, 10, '#ffffff'); txt(g, '9PM', w / 2, 80, 12, '#fff04a'); break;
    case 12: g.fillStyle = '#3aa84a'; g.fillRect(0, 0, w, h); txt(g, 'JCR', w / 2, 26, 26, '#ffffff', 'Georgia, serif'); txt(g, 'GENERAL MEETING', w / 2, 52, 11, '#ffffff'); txt(g, 'Sunday 8pm', w / 2, 70, 11, '#e8ffe0', 'Arial', 'normal'); break;
    case 13: g.fillStyle = '#1a1a2a'; g.fillRect(0, 0, w, h); txt(g, 'CUPPERS', w / 2, 26, 18, '#f0c040', 'Georgia, serif'); txt(g, 'DRAMA', w / 2, 46, 18, '#f0c040', 'Georgia, serif'); txt(g, '4th week · Garden', w / 2, 72, 10, '#d0d0e0', 'Arial', 'normal'); break;
    case 14: g.fillStyle = '#e8f0ff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c3f8a'; g.fillRect(0, 0, w, 24); txt(g, 'NOVICE ROWING', w / 2, 12, 12, '#ffffff'); lines(g, 12, 34, 104, 5, 10, R, '#1c3f8a'); break;
    case 15: g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); lines(g, 10, 12, 108, 8, 10, R, '#444', 1.6); break;   // typed letter
    case 16: env('#f6f4ee'); g.fillStyle = '#5a1a1a'; g.fillRect(8, 8, 50, 10); txt(g, 'BURSARY', 33, 13, 8, '#f4e8d8'); break;
    case 17: { g.fillStyle = '#7ab8e0'; g.fillRect(0, 0, w, h * 0.5); g.fillStyle = '#e8d098'; g.fillRect(0, h * 0.5, w, h * 0.5); g.fillStyle = '#3a7ab0'; g.fillRect(0, h * 0.42, w, 10); txt(g, 'Greetings', w / 2, 20, 16, '#ffffff', 'Georgia, serif'); break; }   // a postcard
    case 18: g.fillStyle = '#ff9a2a'; g.fillRect(0, 0, w, h); txt(g, 'COMEDY', w / 2, 30, 22, '#1a1a1a', 'Impact, Arial Black, sans-serif'); txt(g, 'NIGHT', w / 2, 56, 22, '#1a1a1a', 'Impact, Arial Black, sans-serif'); txt(g, 'Thursday', w / 2, 80, 10, '#1a1a1a'); break;
    case 19: g.fillStyle = '#c0e8f0'; g.fillRect(0, 0, w, h); txt(g, 'CHOIR', w / 2, 28, 18, '#1a3a5a', 'Georgia, serif'); txt(g, 'auditions', w / 2, 50, 12, '#1a3a5a', 'Georgia, serif', 'italic'); lines(g, 20, 66, 88, 2, 9, R, '#1a3a5a'); break;
    case 20: env('#f8f0dc'); break;
    case 21: g.fillStyle = '#c89a62'; g.fillRect(0, 0, w, h); g.fillStyle = '#e0c090'; for (let k = 0; k < 14; k++) g.fillRect(0, k * 7, w, 2); g.fillStyle = '#ffffff'; g.fillRect(30, 30, 70, 36); for (let k = 0; k < 3; k++) scribble(g, 36, 40 + k * 9, 56, R); break;   // padded bag
    case 22: g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); txt(g, 'TERM CARD', w / 2, 14, 12, '#202020', 'Georgia, serif'); lines(g, 10, 28, 108, 7, 9, R, '#666', 1.4); break;
    default: g.fillStyle = '#fff6c0'; g.fillRect(0, 0, w, h); lines(g, 12, 20, 100, 5, 12, R, '#4a4a2a'); break;
  }
  g.restore();
}

function drawSigns(g) {
  let [x, y, w, h] = SIGNS.fire;
  g.fillStyle = '#0a8a3a'; g.fillRect(x, y, w, h); g.fillStyle = '#ffffff'; g.fillRect(x + 8, y + 10, 44, 44); g.fillStyle = '#0a8a3a';
  g.beginPath(); g.arc(x + 34, y + 18, 5, 0, 7); g.fill(); g.fillRect(x + 26, y + 24, 8, 16); g.fillRect(x + 18, y + 40, 8, 12); g.fillRect(x + 34, y + 38, 10, 8);
  txt(g, 'FIRE EXIT', x + 120, y + 32, 22, '#ffffff');
  [x, y, w, h] = SIGNS.parcels; g.fillStyle = '#f4f0e4'; g.fillRect(x, y, w, h); g.strokeStyle = '#333'; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
  txt(g, 'PARCELS', x + w / 2, y + 22, 20, '#1a1a1a', 'Georgia, serif'); txt(g, 'Please sign the book at the Lodge', x + w / 2, y + 44, 12, '#333', 'Arial', 'normal');
  [x, y, w, h] = SIGNS.members; g.fillStyle = '#16233a'; g.fillRect(x, y, w, h); txt(g, 'College members’ post only.', x + w / 2, y + 22, 15, '#f0ead8', 'Georgia, serif', 'normal'); txt(g, 'Please do not remove other people’s post.', x + w / 2, y + 44, 12, '#cfc8b4', 'Arial', 'normal');
  [x, y, w, h] = SIGNS.recycle; g.fillStyle = '#1e6a3a'; g.fillRect(x, y, w, h); txt(g, 'PAPER', x + w / 2, y + 22, 16, '#ffffff'); txt(g, 'recycling', x + w / 2, y + 44, 13, '#d8f0d8', 'Arial', 'normal');
  [x, y, w, h] = SIGNS.plate; g.fillStyle = '#c9a54a'; g.fillRect(x, y, w, h); g.fillStyle = '#e8cf7a'; g.fillRect(x + 3, y + 3, w - 6, 3); txt(g, 'PUSH', x + w / 2, y + 34, 22, '#3a2a10', 'Georgia, serif');
}

// ------------------------------------------------------------------------------------------------ other canvases
function noticeCanvas() {
  const W = 1024, H = 640, { c, g } = canvas(W, H), R = rng(77);
  g.fillStyle = '#b48a58'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '70,44,20' : '230,200,150'},${0.12 + R() * 0.2})`; g.fillRect(R() * W, R() * H, 1 + R() * 2.5, 1 + R() * 2.5); }
  for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(60,40,20,0.5)'; g.beginPath(); g.arc(R() * W, R() * H, 1.4, 0, 7); g.fill(); }   // old pin holes
  const pin = (x, y, col) => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(x + 2, y + 3, 6, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x - 2, y - 2, 2, 0, 7); g.fill(); };
  const paper = (x, y, w, h, bg, rot, draw, pinCol = '#c82a2a') => {
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
    g.fillStyle = bg; g.fillRect(-w / 2, -h / 2, w, h);
    g.translate(-w / 2, -h / 2); draw(w, h); g.restore();
    pin(x + w / 2 + Math.sin(rot) * h * 0.45, y + 10, pinCol);
  };
  const L = (t, x, y, s, col = '#1a1a1a', f = 'Georgia, serif', wgt = 'normal', al = 'left') => txt(g, t, x, y, s, col, f, wgt, al);
  // term card
  paper(24, 22, 300, 400, '#fbf9f2', -0.015, (w) => {
    L('WORCESTER COLLEGE', w / 2, 30, 18, '#1a1a1a', 'Georgia, serif', 'bold', 'center');
    L('Michaelmas Term 2013', w / 2, 56, 17, '#5a1a1a', 'Georgia, serif', 'italic', 'center');
    g.fillStyle = '#5a1a1a'; g.fillRect(30, 72, w - 60, 1.5);
    const rows = [['0th wk', 'Collections; Freshers’ Fair'], ['1st wk', 'Full Term begins Sun 13 Oct'], ['', 'Matriculation (subfusc!)'], ['2nd wk', 'JCR General Meeting'], ['3rd wk', 'Bop, Cellar Bar'], ['4th wk', 'Cuppers Drama'], ['5th wk', 'Tutorial reports'], ['6th wk', 'Blues, everybody'], ['7th wk', 'Christ Church Regatta'], ['8th wk', 'Full Term ends Sat 7 Dec']];
    rows.forEach(([a, b], i) => { L(a, 28, 98 + i * 27, 13, '#5a1a1a', 'Georgia, serif', 'bold'); L(b, 96, 98 + i * 27, 13, '#1a1a1a'); });
    L('Formal Hall: Mon, Wed, Sat', w / 2, 380, 12, '#444', 'Georgia, serif', 'italic', 'center');
  });
  // rowing sign-up sheet
  paper(350, 30, 250, 330, '#ffffff', 0.02, (w) => {
    g.fillStyle = '#1c3f8a'; g.fillRect(0, 0, w, 52); L('NOVICE ROWING', w / 2, 20, 20, '#ffffff', 'Arial, sans-serif', 'bold', 'center'); L('Sign up below — no experience needed', w / 2, 40, 11, '#dfe8ff', 'Arial', 'normal', 'center');
    const R2 = rng(5); g.strokeStyle = '#9aa8c8'; g.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const yy = 74 + i * 21; g.beginPath(); g.moveTo(14, yy + 8); g.lineTo(w - 14, yy + 8); g.stroke(); L(String(i + 1) + '.', 16, yy, 11, '#555', 'Arial'); if (i < 7) scribble(g, 40, yy + 2, 60 + R2() * 90, R2, ['#1a2a8a', '#1a1a1a', '#8a1a1a'][i % 3], 1.6); }
    L('Outings 6.30am. Yes, AM.', w / 2, 318, 12, '#8a1a1a', 'Arial', 'bold', 'center');
  }, '#2a5ac8');
  // JCR meeting
  paper(628, 24, 210, 170, '#fff3a0', -0.03, (w) => {
    L('JCR', w / 2, 30, 30, '#1a1a1a', 'Georgia, serif', 'bold', 'center'); L('GENERAL MEETING', w / 2, 60, 15, '#1a1a1a', 'Arial', 'bold', 'center');
    L('Sunday, 8pm, the JCR', w / 2, 86, 13, '#333', 'Arial', 'normal', 'center'); L('Motions to the Secretary', w / 2, 110, 12, '#333', 'Arial', 'normal', 'center'); L('by Friday. Biscuits.', w / 2, 128, 12, '#333', 'Arial', 'normal', 'center');
  }, '#2a9a3a');
  // lost property
  paper(860, 40, 150, 250, '#e4f0f8', 0.025, (w) => {
    L('LOST', w / 2, 24, 20, '#1a1a1a', 'Arial', 'bold', 'center'); L('PROPERTY', w / 2, 46, 16, '#1a1a1a', 'Arial', 'bold', 'center');
    ['at the Lodge:', '• 1 gown (commoner)', '• 3 umbrellas', '• bike lock key', '• one brown brogue', '• a scarf, striped', '', 'Unclaimed items go', 'to charity at the', 'end of term.'].forEach((t, i) => L(t, 10, 76 + i * 16, 11, '#222', 'Arial'));
  }, '#e0b020');
  // bop flyer
  paper(640, 220, 190, 250, '#ff3c9a', 0.04, (w) => {
    L('BOP', w / 2, 70, 76, '#fff04a', 'Impact, Arial Black, sans-serif', 'normal', 'center'); L('THEME: SPACE', w / 2, 140, 18, '#ffffff', 'Arial', 'bold', 'center');
    L('Friday 3rd week', w / 2, 176, 14, '#ffffff', 'Arial', 'normal', 'center'); L('Cellar Bar · 9pm', w / 2, 198, 14, '#ffffff', 'Arial', 'normal', 'center'); L('Stings £4.50', w / 2, 226, 13, '#fff04a', 'Arial', 'bold', 'center');
  }, '#1a1a1a');
  // library notice
  paper(350, 390, 260, 150, '#ffffff', -0.02, (w) => {
    g.fillStyle = '#5a1a1a'; g.fillRect(0, 0, w, 30); L('COLLEGE LIBRARY', w / 2, 15, 15, '#ffffff', 'Georgia, serif', 'bold', 'center');
    ['Please return all books before the end', 'of term. Recall notices are not optional.', 'Overdue fines: 20p per day per book.', 'Silence in the Library, please.'].forEach((t, i) => L(t, 14, 52 + i * 22, 12, '#222', 'Arial'));
  });
  // small cards
  paper(44, 452, 150, 100, '#ffffff', 0.05, (w) => { L('BIKE FOR SALE', w / 2, 20, 13, '#1a1a1a', 'Arial', 'bold', 'center'); L('3-speed, basket,', w / 2, 44, 11, '#333', 'Arial', 'normal', 'center'); L('one working light. £40', w / 2, 62, 11, '#333', 'Arial', 'normal', 'center'); for (let k = 0; k < 6; k++) { g.fillStyle = '#ccc'; g.fillRect(8 + k * 23, 80, 1, 20); } });
  paper(210, 470, 120, 90, '#f8d6dc', -0.06, (w) => { L('Room swap?', w / 2, 22, 13, '#1a1a1a', 'Georgia, serif', 'bold', 'center'); L('Have: Staircase 13', w / 2, 46, 10, '#333', 'Arial', 'normal', 'center'); L('Want: anything with', w / 2, 62, 10, '#333', 'Arial', 'normal', 'center'); L('a working radiator', w / 2, 76, 10, '#333', 'Arial', 'normal', 'center'); }, '#2a5ac8');
  paper(860, 320, 150, 200, '#fbf9f2', -0.02, (w) => { L('CHAPEL', w / 2, 22, 16, '#1a1a1a', 'Georgia, serif', 'bold', 'center'); L('Choral Evensong', w / 2, 52, 12, '#333', 'Georgia, serif', 'italic', 'center'); L('Sun, Tue, Thu, Fri', w / 2, 72, 11, '#333', 'Arial', 'normal', 'center'); L('6pm. All welcome.', w / 2, 90, 11, '#333', 'Arial', 'normal', 'center'); L('Sherry after.', w / 2, 112, 11, '#5a1a1a', 'Arial', 'bold', 'center'); });
  paper(640, 500, 190, 120, '#ffffff', 0.02, (w) => { L('LAUNDRY', w / 2, 20, 14, '#1a1a1a', 'Arial', 'bold', 'center'); ['Whoever took a grey hoodie', 'from dryer 2: it was mine', 'and I miss it. — 13.4'].forEach((t, i) => L(t, w / 2, 48 + i * 18, 11, '#333', 'Arial', 'normal', 'center')); });
  return c;
}
function linoCanvas() {
  const W = 1024, H = Math.round(1024 * 5.2 / 6), { c, g } = canvas(W, H), R = rng(19), ppm = W / 6;
  const t = 0.3 * ppm;
  for (let y = 0; y < H; y += t) for (let x = 0; x < W; x += t) {
    const k = ((Math.round(x / t) + Math.round(y / t)) % 2);
    g.fillStyle = k ? '#b9b2a2' : '#cfc8b6'; g.fillRect(x, y, t + 1, t + 1);
    for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(${k ? '90,84,72' : '255,250,240'},${0.08 + R() * 0.1})`; g.lineWidth = 1 + R() * 2; g.beginPath(); const sx = x + R() * t, sy = y + R() * t; g.moveTo(sx, sy); g.bezierCurveTo(sx + (R() - 0.5) * t, sy + (R() - 0.5) * t, sx + (R() - 0.5) * t, sy + (R() - 0.5) * t, sx + (R() - 0.5) * t * 1.4, sy + (R() - 0.5) * t * 1.4); g.stroke(); }
  }
  g.strokeStyle = 'rgba(60,54,44,0.35)'; g.lineWidth = 1; for (let y = 0; y <= H; y += t) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (let x = 0; x <= W; x += t) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  // wear: canvas top = the door wall (z 0), bottom = the far rack; left = the west rack
  const px = (x) => (x + 3) * ppm, pz = (z) => (-z) * ppm;
  const worn = (x, z, rx, rz, a) => { const gr = g.createRadialGradient(px(x), pz(z), 0, px(x), pz(z), Math.max(rx, rz) * ppm); gr.addColorStop(0, `rgba(80,72,60,${a})`); gr.addColorStop(1, 'rgba(80,72,60,0)'); g.save(); g.translate(px(x), pz(z)); g.scale(rx / Math.max(rx, rz), rz / Math.max(rx, rz)); g.translate(-px(x), -pz(z)); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); };
  worn(1.7, -0.6, 0.7, 1.0, 0.32); worn(1.1, -2.2, 1.2, 1.2, 0.2); worn(0, -4.2, 2.8, 0.7, 0.24); worn(-2.2, -3.0, 0.7, 2.2, 0.22);
  for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(30,26,20,${0.06 + R() * 0.12})`; g.lineWidth = 0.8 + R() * 1.4; const x = R() * W, y = R() * H, a = R() * 6.3, l = 6 + R() * 26; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }   // scuffs
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, H - 6, W, 6); g.fillRect(0, 0, 6, H);   // dirt line at the racks
  return c;
}
function backCanvas() {   // the inside of one hole (repeat per cell): dark, shadowed under the shelf above and at the sides
  const { c, g } = canvas(64, 64);
  g.fillStyle = '#5a4128'; g.fillRect(0, 0, 64, 64);
  let gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(10,6,2,0.75)'); gr.addColorStop(0.55, 'rgba(10,6,2,0.25)'); gr.addColorStop(1, 'rgba(10,6,2,0.1)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(10,6,2,0.45)'); gr.addColorStop(0.2, 'rgba(10,6,2,0)'); gr.addColorStop(0.8, 'rgba(10,6,2,0)'); gr.addColorStop(1, 'rgba(10,6,2,0.45)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const R = rng(3); for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(30,18,8,${0.15 + R() * 0.15})`; g.beginPath(); const y = R() * 64; g.moveTo(0, y); g.lineTo(64, y + (R() - 0.5) * 4); g.stroke(); }
  return c;
}
function viewCanvas() {   // Pump Quad from the window: paving, a picnic table, the Hall's south wall and its chimney breast
  const { c, g } = canvas(512, 384), R = rng(8);
  const sky = g.createLinearGradient(0, 0, 0, 60); sky.addColorStop(0, '#9cbce0'); sky.addColorStop(1, '#dbe6ee'); g.fillStyle = sky; g.fillRect(0, 0, 512, 60);
  g.fillStyle = '#d8c39a'; g.fillRect(0, 40, 512, 230);
  for (let y = 40; y < 270; y += 18) for (let x = (y / 18) % 2 ? 0 : -20; x < 512; x += 40) { g.fillStyle = `rgba(${R() < 0.5 ? '120,96,60' : '255,240,210'},${0.06 + R() * 0.08})`; g.fillRect(x, y, 39, 17); g.fillStyle = 'rgba(110,90,60,0.25)'; g.fillRect(x, y + 17, 40, 1); g.fillRect(x + 39, y, 1, 18); }
  g.fillStyle = '#cdb68a'; g.fillRect(300, 40, 90, 230); g.fillStyle = 'rgba(80,60,30,0.25)'; g.fillRect(384, 40, 6, 230);   // chimney breast
  g.fillStyle = '#bba57a'; g.fillRect(0, 214, 512, 10);   // string course
  for (const x of [60, 200, 440]) { g.fillStyle = '#2a2622'; g.fillRect(x, 248, 42, 20); g.fillStyle = '#6a6052'; for (let k = 0; k < 6; k++) g.fillRect(x + k * 8, 246, 2, 24); }   // light-well grilles
  g.fillStyle = '#b8b0a0'; g.fillRect(0, 270, 512, 114);
  for (let y = 270; y < 384; y += 26) for (let x = (y / 26) % 2 ? 0 : -30; x < 512; x += 60) { g.fillStyle = `rgba(${R() < 0.5 ? '90,86,80' : '240,236,226'},${0.08 + R() * 0.1})`; g.fillRect(x, y, 59, 25); g.fillStyle = 'rgba(70,66,60,0.35)'; g.fillRect(x, y + 25, 60, 1); }
  g.fillStyle = '#8a6a44'; g.fillRect(120, 300, 210, 12); g.fillRect(110, 326, 230, 8); for (const x of [140, 300]) g.fillRect(x, 312, 8, 50);   // picnic table
  g.fillStyle = '#8a5a3a'; g.fillRect(410, 300, 40, 40); g.fillStyle = '#4a7a3a'; g.beginPath(); g.arc(430, 290, 30, 0, 7); g.fill();   // planted tub
  return c;
}

// ------------------------------------------------------------------------------------------------ builder
export function buildPidge(ctx, game) {
  const S = sharedMats(game), sc = ctx.scene, col = ctx.collider;
  const { X0, X1, Z0, H } = PR;
  const mats = { ...S };
  mats.wall = new THREE.MeshStandardMaterial({ map: wallShade(H, { top: 0.4, bottom: 0.6, skirt: 0.15, skirtCol: '#7a6a58' }), color: 0xefe6cc, roughness: 0.92 });
  mats.ceil = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.95 });
  { const t = tex(linoCanvas, { wrap: false }); t.repeat.set(1 / 6, 1 / 5.2); t.offset.set(0.5, 1); t.needsUpdate = true; mats.lino = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }); }
  mats.pidgeIn = new THREE.MeshStandardMaterial({ map: woodGrain(false, 1, true), color: 0x9a7448, roughness: 0.7 });
  mats.rackOak = new THREE.MeshStandardMaterial({ map: woodGrain(false, 1, true), color: 0xd9b27a, roughness: 0.5 });
  { const t = tex(backCanvas(), { wrap: true }); mats.pidgeBack = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }); }
  const paperC = canvas(AW, AW), pg = paperC.g;
  pg.fillStyle = '#e8e2d0'; pg.fillRect(0, 0, AW, AW);
  for (let i = 0; i < N_POST; i++) drawPost(pg, i);
  drawSigns(pg);
  const paperT = tex(paperC.c, { wrap: false });
  mats.atlas = new THREE.MeshStandardMaterial({ map: paperT, roughness: 0.85, side: THREE.DoubleSide });
  mats.notice = new THREE.MeshStandardMaterial({ map: tex(noticeCanvas, { wrap: false }), roughness: 0.9 });
  mats.sky = skyGlass(); mats.sky.transparent = true; mats.sky.opacity = 0.22;
  mats.viewDay = new THREE.MeshBasicMaterial({ map: tex(viewCanvas, { wrap: false }) });
  mats.tube = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, emissive: 0xeaf2ff, emissiveIntensity: 1.6, roughness: 0.3 });
  mats.doorPaint = new THREE.MeshStandardMaterial({ color: 0x1f3a2e, roughness: 0.45 });
  mats.bin = new THREE.MeshStandardMaterial({ color: 0x2a6a3a, roughness: 0.55 });
  mats.card = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.95 });
  mats.steel = new THREE.MeshStandardMaterial({ color: 0x9a9ea2, metalness: 0.5, roughness: 0.4 });

  const B = new Batch();
  // ---------------------------------------------------------------- shell
  const wallFace = (x0, z0, x1, z1, outline, holes = []) => { B.push(frame(x0, 0, z0, x1 - x0, z1 - z0)); B.face('wall', outline, holes); B.pop(); };
  const LW = X1 - X0, LD = -Z0;
  wallFace(X0, Z0, X1, Z0, rectPts(0, 0, LW, H));                     // north (behind the far rack)
  wallFace(X0, 0, X0, Z0, rectPts(0, 0, LD, H));                      // west
  wallFace(X1, Z0, X1, 0, rectPts(0, 0, LD, H));                      // east
  const sd0 = X1 - (PR.door.x + PR.door.w / 2), sd1 = X1 - (PR.door.x - PR.door.w / 2), sw = X1 - PR.win.x;
  const winHole = rectPts(sw - PR.win.w / 2, PR.win.y0, sw + PR.win.w / 2, PR.win.y1);
  const sw2 = PR.win2 ? X1 - PR.win2.x : 0, winHole2 = PR.win2 ? rectPts(sw2 - PR.win2.w / 2, PR.win2.y0, sw2 + PR.win2.w / 2, PR.win2.y1) : null;
  wallFace(X1, 0, X0, 0, [[0, 0], [sd0, 0], [sd0, PR.door.h], [sd1, PR.door.h], [sd1, 0], [LW, 0], [LW, H], [0, H]], winHole2 ? [winHole, winHole2] : [winHole]);
  col.addSegment(X0, Z0, X1, Z0); col.addSegment(X0, 0, X0, Z0); col.addSegment(X1, Z0, X1, 0);
  col.addSegment(X1, 0, PR.door.x + PR.door.w / 2, 0); col.addSegment(PR.door.x - PR.door.w / 2, 0, X0, 0);
  const walkIn = !!(ctx.seamless && ctx.addDoor);      // a real doorway (core/interiors.js): the leaf below is a real door
  if (!walkIn) col.addSegment(PR.door.x - PR.door.w / 2, 0, PR.door.x + PR.door.w / 2, 0);   // (old path: the door is shut, you leave with E)
  B.flat('lino', [[X0, Z0], [X1, Z0], [X1, 0], [X0, 0]], 0);
  B.flat('ceil', [[X0, Z0], [X1, Z0], [X1, 0], [X0, 0]], H, [], true);
  // cornice round the ceiling
  for (const [a, b, c2, d] of [[X0, Z0, X1, Z0], [X1, 0, X0, 0], [X0, 0, X0, Z0], [X1, Z0, X1, 0]]) { B.push(frame(a, 0, b, c2 - a, d - b)); B.box('plasterWhite', Math.hypot(c2 - a, d - b) / 2, H - 0.05, 0.03, Math.hypot(c2 - a, d - b), 0.1, 0.06); B.pop(); }

  // ---------------------------------------------------------------- south wall: door, window, radiator, signs
  B.push(frame(X1, 0, 0, -1, 0));
  B.reveal('plasterWhite', rectPts(sd0, 0, sd1, PR.door.h), 0, PR.punch ? -(PR.leaf + 0.025) : -0.28, true);      // (hand-built front: only as far as the leaf; the stone reveal beyond is the front's own)
  if (!walkIn) {
    B.boxXZ('doorPaint', sd0, sd1, 0, PR.door.h, -0.2, -0.16);   // leaf
    for (const [a, b] of [[0.12, 0.95], [1.1, 2.05]]) for (const k of [0, 1]) { const s0 = sd0 + 0.1 + k * 0.42, s1 = s0 + 0.36; B.boxXZ('doorPaint', s0, s1, a, b, -0.16, -0.14); }
    B.boxXZ('brass', sd1 - 0.14, sd1 - 0.08, 1.0, 1.06, -0.16, -0.1); B.sign('atlas', sd0 + 0.38, 1.2, sd0 + 0.62, 1.32, -0.135, uvR(...SIGNS.plate));
  }
  // the inside of Staircase 15's own door (locked from this side): painted leaf in an architrave
  if (PR.stair) { const c = X1 - PR.stair.x, a = c - PR.stair.w / 2, b = c + PR.stair.w / 2, h = PR.stair.h; B.boxXZ('doorPaint', a, b, 0, h, 0, 0.03); for (const [y0, y1] of [[0.12, 0.95], [1.1, h - 0.12]]) for (const k of [0, 1]) { const s0 = a + 0.08 + k * 0.39, s1 = s0 + 0.34; B.boxXZ('doorPaint', s0, s1, y0, y1, 0.03, 0.045); }
    B.boxXZ('brass', a + 0.07, a + 0.13, 1.0, 1.06, 0.03, 0.09); B.boxXZ('plasterWhite', a - 0.07, a, 0, h + 0.07, 0, 0.04); B.boxXZ('plasterWhite', b, b + 0.07, 0, h + 0.07, 0, 0.04); B.boxXZ('plasterWhite', a - 0.07, b + 0.07, h, h + 0.07, 0, 0.04); }
  B.boxXZ('plasterWhite', sd0 - 0.07, sd0, 0, PR.door.h + 0.07, 0, 0.025); B.boxXZ('plasterWhite', sd1, sd1 + 0.07, 0, PR.door.h + 0.07, 0, 0.025); B.boxXZ('plasterWhite', sd0 - 0.07, sd1 + 0.07, PR.door.h, PR.door.h + 0.07, 0, 0.025);   // architrave
  B.sign('atlas', (sd0 + sd1) / 2 - 0.3, PR.door.h + 0.16, (sd0 + sd1) / 2 + 0.3, PR.door.h + 0.36, 0.012, uvR(...SIGNS.fire));
  B.boxXZ('plasterWhite', sd0 - 0.32, sd0 - 0.22, 1.25, 1.37, 0, 0.012); B.boxXZ('black', sd0 - 0.29, sd0 - 0.25, 1.29, 1.33, 0.012, 0.02);   // light switch
  sash(B, sw - PR.win.w / 2, sw + PR.win.w / 2, PR.win.y0, PR.win.y1, PR.punch ? PR.glass : PR.WALL - 0.02, { cols: 3, rows: 4, glassKey: 'sky' });      // (six over six, like the range's painted sashes; inside the wall's thickness)
  if (PR.win2) sash(B, sw2 - PR.win2.w / 2, sw2 + PR.win2.w / 2, PR.win2.y0, PR.win2.y1, PR.glass, { cols: 4, rows: 4, glassKey: 'sky' });      // (eight over eight)
  // radiator under the window: column radiator on brackets, pipe down to the floor
  { const r0 = sw - 0.6, n = 16; for (let k = 0; k < n; k++) B.boxXZ('radiator', r0 + k * 0.075, r0 + k * 0.075 + 0.055, 0.14, 0.78, 0.04, 0.12); B.boxXZ('radiator', r0, r0 + n * 0.075, 0.18, 0.22, 0.05, 0.11); B.boxXZ('radiator', r0, r0 + n * 0.075, 0.7, 0.74, 0.05, 0.11); B.cyl('radiator', r0 - 0.06, 0, 0.08, 0.012, 0.2, 6, false); B.cyl('brass', r0 - 0.06, 0.2, 0.08, 0.025, 0.05, 8, true); }
  { const c = X1 + 0.5; B.sign('atlas', c - 0.8, 2.3, c + 0.8, 2.6, 0.012, uvR(...SIGNS.members)); }      // (over Staircase 15's door: the window now rises to 3.18)
  B.pop();
  if (!walkIn) { B.push(frame(X1, 0, 2.6, -1, 0)); B.sign('viewDay', sw - 2.6, -0.6, sw + 2.6, 3.4, 0, [0, 0, 1, 1]); B.pop(); }   // (old path: a picture of Pump Quad beyond the glass; walk-in: the glass is a real opening onto the quad)
  else mats.sky.opacity = 0.1;

  // ---------------------------------------------------------------- pigeonhole racks
  const cw = (r) => r.L / r.cols, rh = (RK.y1 - RK.y0) / RK.rows, D = RK.depth;
  // name slips: hole index runs down each column, columns left to right, the west rack first (alphabetical)
  const total = RACKS.reduce((n, r) => n + r.cols * RK.rows, 0);
  const letters = surnameLetters(total);
  const friendAt = new Map(PIDGE_FRIENDS.map((f) => [f.rack + ':' + f.col + ':' + f.row, f.name]));
  const holes = [];   // {rack, col, row, slot, label, kind}
  let hi = 0, si = 0;
  RACKS.forEach((r, ri) => { for (let c = 0; c < r.cols; c++) for (let row = RK.rows - 1; row >= 0; row--) {
    const k = ri + ':' + c + ':' + row, R1 = rng(hi * 7 + 3)();
    const own = ri === OWN.rack && c === OWN.col && row === OWN.row;
    const kind = own ? 'own' : friendAt.has(k) ? 'name' : R1 < 0.09 ? 'blank' : 'init';
    holes.push({ rack: ri, col: c, row, slot: si++, label: kind === 'name' ? friendAt.get(k) : letters[hi], kind, letter: letters[hi] }); hi++;
  } });
  const headerSlot0 = 300;
  RACKS.forEach((r, ri) => {
    B.push(frame(r.o[0], 0, r.o[1], r.a[0], r.a[1]));
    const L = r.L, w = cw(r);
    B.sign('pidgeBack', 0, RK.y0, L, RK.y1, 0.012, [0, 0, r.cols, RK.rows]);
    for (let k = 0; k <= RK.rows; k++) {
      const y = RK.y0 + k * rh, end = k === 0 || k === RK.rows;
      B.boxXZ('pidgeIn', 0, L, y - 0.009, y + 0.009, 0.012, D - 0.02, { top: true });
      B.boxXZ('rackOak', -0.012, L + 0.012, y - (end ? 0.022 : 0.016), y + (end ? 0.022 : 0.016), D - 0.022, D);
    }
    for (let c = 0; c <= r.cols; c++) {
      const s = c * w, end = c === 0 || c === r.cols;
      B.boxXZ('pidgeIn', s - 0.007, s + 0.007, RK.y0, RK.y1, 0.012, D - 0.02);
      B.boxXZ('rackOak', s - (end ? 0.018 : 0.011), s + (end ? 0.018 : 0.011), RK.y0 - 0.02, RK.y1 + 0.02, D - 0.022, D);
      if (end) B.boxXZ('rackOak', s - 0.018, s + 0.018, 0, RK.y1 + 0.24, 0, D);
    }
    // plinth cupboard + kick board, cornice with the divider letters
    B.boxXZ('rackOak', 0, L, 0.06, RK.y0 - 0.02, 0.0, D);
    B.boxXZ('black', 0.02, L - 0.02, 0, 0.06, 0.02, D - 0.03);
    for (let c = 0; c < r.cols; c += 2) B.boxXZ('rackOak', c * w + 0.03, Math.min(L, (c + 2) * w) - 0.03, 0.1, RK.y0 - 0.06, D, D + 0.012);   // cupboard doors
    B.boxXZ('rackOak', -0.03, L + 0.03, RK.y1 + 0.02, RK.y1 + 0.2, 0, D + 0.01);
    B.boxXZ('rackOak', -0.05, L + 0.05, RK.y1 + 0.2, RK.y1 + 0.24, 0, D + 0.04);
    for (let c = 0; c < r.cols; c++) {
      const top = holes.find((h) => h.rack === ri && h.col === c && h.row === RK.rows - 1), bot = holes.find((h) => h.rack === ri && h.col === c && h.row === 0);
      const lab = top.letter === bot.letter ? top.letter : `${top.letter}–${bot.letter}`;
      const hs = headerSlot0 + (ri ? RACKS[0].cols : 0) + c; r['hdr' + c] = { lab, hs };
      const [px, py] = slot(hs); B.sign('atlas', c * w + 0.03, RK.y1 + 0.06, (c + 1) * w - 0.03, RK.y1 + 0.16, D + 0.012, uvR(px, py, 64, 20));
    }
    // name slips in brass card holders on the shelf lip under each hole
    for (const h of holes) if (h.rack === ri) {
      const s0 = h.col * w + w * 0.2, s1 = h.col * w + w * 0.8, y = RK.y0 + h.row * rh;
      B.boxXZ('brass', s0 - 0.006, s1 + 0.006, y - 0.016, y + 0.014, D, D + 0.004);
      const [px, py] = slot(h.slot); B.sign('atlas', s0, y - 0.013, s1, y + 0.011, D + 0.0045, uvR(px, py, 64, 20));
    }
    B.pop();
    // collision: the rack is a solid box in front of its wall
    const [ox, oz] = r.o, [ax, az] = r.a, nx = -az, nz = ax;
    col.addBox(ox + ax * L / 2 + nx * D / 2, oz + az * L / 2 + nz * D / 2, Math.abs(ax) * L + Math.abs(nx) * D, Math.abs(az) * L + Math.abs(nz) * D, 0);
  });
  // draw the slips + headers into the atlas
  for (const h of holes) drawCard(pg, h.slot, h.kind === 'own' ? ((game.player && game.player.name) || 'You') : h.label, h.kind);
  RACKS.forEach((r) => { for (let c = 0; c < r.cols; c++) drawCard(pg, r['hdr' + c].hs, r['hdr' + c].lab, 'header'); });
  paperT.needsUpdate = true;

  // ---------------------------------------------------------------- post in the holes
  const Rp = rng(4242);
  const postUV = (i) => { const [px, py] = postCell(i); return uvR(px, py, 128, 96); };
  const envPick = () => { const q = Rp(); return q < 0.42 ? Math.floor(Rp() * 4) : q < 0.52 ? 4 + Math.floor(Rp() * 2) : q < 0.6 ? 16 : q < 0.66 ? 20 : q < 0.7 ? 6 : q < 0.74 ? 7 : q < 0.77 ? 8 : 9 + Math.floor(Rp() * 15); };
  function postIn(Bt, r, c, row, items) {
    const w = cw(r), s0 = c * w, y = RK.y0 + row * rh + 0.009;
    Bt.push(frame(r.o[0], 0, r.o[1], r.a[0], r.a[1]));
    let lay = 0;
    for (const it of items) {
      const kind = it.kind || (Rp() < 0.55 ? 'up' : 'flat'), cell = it.cell ?? envPick();
      const ew = Math.min(w - 0.05, 0.16 + Rp() * 0.04), eh = Math.min(rh - 0.035, ew * 0.7);
      if (kind === 'up') {   // leaning against the back of the hole
        const sx = s0 + 0.025 + Rp() * (w - 0.05 - ew), zb = 0.03 + lay * 0.012 + Rp() * 0.03, zt = 0.014 + lay * 0.012;
        Bt.card('atlas', [sx, y, zb], [sx + ew, y, zb], [sx + ew, y + eh, zt], [sx, y + eh, zt], postUV(cell));
        lay++;
      } else if (kind === 'flat') {   // lying in the hole, a little askew; some stick out over the lip
        const a = (Rp() - 0.5) * 0.5, cx = s0 + w / 2 + (Rp() - 0.5) * 0.04, out = it.out ? 0.06 : 0, cz = D / 2 + 0.02 + out * 0.5 + Rp() * 0.02, dd = Math.min(0.2, D - 0.06 + out), hw = Math.min(ew, w - 0.03) / 2;
        const yy = y + (it.out ? 0.011 : 0.004) + lay * 0.005, ca = Math.cos(a), sa = Math.sin(a);
        const P = (u, v) => [cx + u * ca + v * sa, yy, cz - u * sa + v * ca];
        Bt.card('atlas', P(-hw, dd / 2), P(hw, dd / 2), P(hw, -dd / 2), P(-hw, -dd / 2), postUV(cell));
        lay++;
      } else if (kind === 'parcel') {
        Bt.boxXZ('card', s0 + 0.03, s0 + w - 0.03, y, y + rh * 0.62, 0.04, D - 0.04);
        Bt.sign('atlas', s0 + 0.06, y + 0.03, s0 + w - 0.06, y + rh * 0.5, D - 0.039, postUV(21));
      }
    }
    Bt.pop();
  }
  for (const h of holes) {
    if (h.kind === 'own') continue;
    const q = rng(h.slot * 31 + 7)(), r = RACKS[h.rack];
    if (h.kind === 'blank' || q < 0.36) continue;
    const n = q < 0.7 ? 1 : q < 0.9 ? 2 : 3, items = [];
    for (let k = 0; k < n; k++) items.push(k === 0 && q > 0.96 ? { kind: 'parcel' } : { out: Rp() < 0.12 });
    postIn(B, r, h.col, h.row, items);
  }
  // your own hole: a separate small mesh (shown until you take today's post)
  const OB = new Batch();
  postIn(OB, RACKS[OWN.rack], OWN.col, OWN.row, [{ kind: 'up', cell: 0 }, { kind: 'up', cell: 11 }, { kind: 'flat', cell: 15, out: true }]);
  const ownGroup = new THREE.Group(); ownGroup.name = 'pidge:own'; sc.add(ownGroup);
  buildBatch(OB, ownGroup, mats);

  // ---------------------------------------------------------------- east wall: noticeboard, parcel shelf, bin
  B.push(frame(X1, 0, Z0, 0, 1));   // s = z - Z0 (0 at the far rack), facing west into the room
  const nb0 = 0.75, nb1 = 2.55, ny0 = 1.2, ny1 = 2.3;
  B.boxXZ('darkOak', nb0 - 0.05, nb1 + 0.05, ny0 - 0.05, ny1 + 0.05, 0, 0.03);
  B.sign('notice', nb0, ny0, nb1, ny1, 0.031, [0, 0, 1, 1]);
  for (const [a, b, y] of [[nb0 - 0.05, nb1 + 0.05, ny0 - 0.05], [nb0 - 0.05, nb1 + 0.05, ny1 + 0.05]]) B.boxXZ('darkOak', a, b, y - 0.02, y + 0.02, 0, 0.045);
  // parcel shelf: two slatted shelves on steel brackets
  const ps0 = 0.55, ps1 = 2.75, pd = 0.42;
  for (const y of [0.42, 0.88]) { B.boxXZ('beech', ps0, ps1, y - 0.025, y, 0.0, pd); B.boxXZ('beech', ps0, ps1, y - 0.06, y - 0.025, pd - 0.03, pd); }
  for (const s of [ps0 + 0.05, (ps0 + ps1) / 2, ps1 - 0.05]) { B.boxXZ('steel', s - 0.015, s + 0.015, 0, 0.853, pd - 0.05, pd - 0.02); B.boxXZ('steel', s - 0.015, s + 0.015, 0, 0.853, 0.003, 0.03);   /* legs stop under the top board and stand 3 mm off the wall: their tops used to lie in the board's top face and flicker */ }
  B.sign('atlas', (ps0 + ps1) / 2 - 0.32, 0.81, (ps0 + ps1) / 2 + 0.32, 0.86, pd + 0.002, uvR(...SIGNS.parcels));
  const parcels = [[0.62, 0.42, 0.42, 0.3, 0.32, 0], [1.1, 0.42, 0.34, 0.22, 0.28, 0.1], [1.5, 0.42, 0.5, 0.36, 0.36, -0.06], [2.1, 0.42, 0.3, 0.18, 0.3, 0.2], [0.7, 0.88, 0.36, 0.16, 0.26, 0.15], [1.2, 0.88, 0.28, 0.12, 0.22, -0.2], [1.75, 0.88, 0.44, 0.26, 0.3, 0.05], [2.3, 0.88, 0.3, 0.08, 0.24, 0]];
  for (const [s, y, w, h, d, rot] of parcels) {
    const cx = s + w / 2, cz = 0.04 + d / 2;
    B.box(h < 0.1 ? 'paper' : 'card', cx, y + h / 2, cz, w, h, d, rot);   // (low ones: padded bags)
    if (h >= 0.1) B.box('beech', cx, y + h + 0.001, cz, w * 0.98, 0.002, 0.05, rot);   // tape
    B.push(new THREE.Matrix4().makeRotationY(rot).setPosition(cx, y + h / 2, cz)); B.sign('atlas', -w * 0.3, -h * 0.25, w * 0.2, h * 0.25, d / 2 + 0.002, postUV(Rp() < 0.5 ? 1 : 3)); B.pop();
  }
  // recycling bin, overflowing with flyers, by the door
  {
    const bs = 4.55, bz = 0.3;
    B.cyl('bin', bs, 0, bz, 0.25, 0.74, 14, false, 0.22);
    B.cyl('bin', bs, 0.72, bz, 0.265, 0.04, 14, false, 0.265);
    B.cyl('black', bs, 0.6, bz, 0.235, 0.01, 14, true);   // the bottom of the heap
    const Rb = rng(61);
    for (let k = 0; k < 16; k++) {
      const a = Rb() * 6.28, rr = Rb() * 0.2, y = 0.72 + 0.02 + Rb() * 0.12, cx = bs + Math.cos(a) * rr, cz = bz + Math.sin(a) * rr, ang = Rb() * 6.28, tilt = (Rb() - 0.5) * 0.9, hw = 0.075 + Rb() * 0.03, hd = 0.1 + Rb() * 0.04;
      const ca = Math.cos(ang), sa = Math.sin(ang), P = (u, v) => [cx + u * ca + v * sa, y + v * tilt * 0.5, cz - u * sa + v * ca];
      B.card('atlas', P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd), postUV([11, 12, 13, 14, 18, 19, 22, 15][k % 8]));
    }
    for (let k = 0; k < 5; k++) {   // fallen on the floor
      const cx = bs - 0.5 + Rb() * 0.8, cz = 0.3 + Rb() * 0.6, ang = Rb() * 6.28, ca = Math.cos(ang), sa = Math.sin(ang), hw = 0.07, hd = 0.1, y = 0.003 + k * 0.001;
      const P = (u, v) => [cx + u * ca + v * sa, y, cz - u * sa + v * ca];
      B.card('atlas', P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd), postUV([11, 18, 12, 14, 9][k]));
    }
  }
  B.pop();
  col.addBox(X1 - 0.21, Z0 + (ps0 + ps1) / 2, 0.42, ps1 - ps0, 0); col.addCircle(X1 - 0.3, Z0 + 4.55, 0.28);
  B.push(frame(X1 - 0.3 - 0.248, 0, Z0 + 4.55 - 0.13, 0, 1)); B.sign('atlas', 0, 0.38, 0.26, 0.51, 0, uvR(...SIGNS.recycle)); B.pop();   // label on the bin's room side

  // ---------------------------------------------------------------- lights: two fluorescent battens
  for (const x of [-1.0, 1.2]) {
    B.boxXZ('plasterWhite', x - 0.09, x + 0.09, H - 0.08, H - 0.01, -3.3, -1.9);
    B.boxXZ('tube', x - 0.035, x + 0.035, H - 0.11, H - 0.075, -3.25, -1.95);
  }
  buildBatch(B, sc, mats);
  mergeStatic(sc, new Set([ownGroup]));
  // the door onto Pump Quad: a heavy painted door hung on the corner side, opening inwards; it stays where it is left
  const door = walkIn ? ctx.addDoor({ kind: 'hinged', style: 'oak', at: [PR.door.x + PR.door.w / 2, PR.punch ? PR.leaf : PR.WALL - 0.1], y: 0, w: PR.door.w, h: PR.door.h, dir: -Math.PI / 2, swing: -1, closer: false, heavy: true, rest: 0.5, thick: 0.05, mats: { leaf: mats.doorPaint, handle: S.brass }, portal: 0 }) : null;
  const { amb, hemi } = ambientOf(sc);
  const l1 = addPoint(sc, -0.9, 2.5, -2.9, 0xf4f6ff, 3.2, 9), l2 = addPoint(sc, 1.2, 2.5, -2.4, 0xf4f6ff, 3.2, 9);
  void l1; void l2;
  const ownSlot = holes.find((h) => h.kind === 'own').slot;
  let shownName = null;
  const ownR = RACKS[OWN.rack], [ox, oz] = ownR.o, ownS = (OWN.col + 0.5) * cw(ownR);
  return {
    spawn: PIDGE_SLOTS[0].slice(0, 2), heading: PIDGE_SLOTS[0][2], exit: [PR.door.x, -0.55],
    own: [ox + ownR.a[0] * ownS, oz + ownR.a[1] * ownS + RK.depth + 0.45],   // where you stand to check it
    ownHole: [ox + ownR.a[0] * ownS, RK.y0 + (OWN.row + 0.5) * rh, oz + RK.depth],
    notice: [X1 - 0.6, Z0 + (nb0 + nb1) / 2], parcels: [X1 - 0.75, Z0 + (ps0 + ps1) / 2], bin: [X1 - 0.75, Z0 + 4.55], window: [PR.win.x, -0.7],
    friends: PIDGE_FRIENDS.map((f) => f.name),
    holes: holes.length, ownGroup, door,
    setOwnPost(on) { ownGroup.visible = !!on; },
    setName(name) { if (name === shownName) return; shownName = name; drawCard(pg, ownSlot, name || 'You', 'own'); for (const h of holes) if (h.kind === 'name') drawCard(pg, h.slot, h.label === name ? '' : h.label, h.label === name ? 'blank' : 'name'); paperT.needsUpdate = true; },
    setLight(d) { mats.sky.userData.setDay(d); mats.viewDay.color.setScalar(0.1 + 0.9 * d); if (amb) amb.intensity = 0.42 + d * 0.15; if (hemi) hemi.intensity = 0.3 + d * 0.2; },
  };
}
