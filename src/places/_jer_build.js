// Geometry for the Jericho pass (owned by places/jericho.js) — see docs/research/east_oxford_jericho.md.
// All in the shared batch-4 atlas draw (_b4_kit.js). q = LOD level (0 near, 1 mid, 2 far).
import { RB, TAU, frame, prismN, glowCard, bulb, bike, LIT, DARK } from './_b4_kit.js';
import { faces, faceFrame, centroid } from './_eo_kit.js';
import { signAt } from './_eo_build.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** oriented box of a footprint: centre, long axis (unit), half-length, half-width (by projecting the points) */
export function obbOf(poly) {
  const [cx, cz] = centroid(poly);
  let best = null;
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * Math.PI, ux = Math.cos(a), uz = Math.sin(a);
    let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const [x, z] of poly) { const s = (x - cx) * ux + (z - cz) * uz, t = -(x - cx) * uz + (z - cz) * ux; s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
    const area = (s1 - s0) * (t1 - t0);
    if (!best || area < best.area) best = { area, ux, uz, s0, s1, t0, t1 };
  }
  const { ux, uz, s0, s1, t0, t1 } = best, sm = (s0 + s1) / 2, tm = (t0 + t1) / 2;
  let L = (s1 - s0) / 2, W = (t1 - t0) / 2, ax = ux, az = uz;
  const c = [cx + ux * sm - uz * tm, cz + uz * sm + ux * tm];
  if (W > L) { [L, W] = [W, L]; ax = -uz; az = ux; }
  return { c, ux: ax, uz: az, L, W };
}

// ------------------------------------------------------------------------------------------------ St Barnabas
/**
 * St Barnabas, Jericho (K: Arthur Blomfield, 1868-69, Italianate Romanesque basilica after San Clemente / Torcello;
 * the campanile finished 1872, ~132 ft (40 m) after it was lowered and its roof flattened in 1893, three stages divided by
 * brick bands; Grade I — Jericho Centre, Historic England 1299646, Wrenn Report). G: the tower's place on the footprint
 * (the corner nearest the canal), the render colour, every dimension of the nave, the windows.
 */
export const BARNABAS = { id: 'w304699783', towerH: 40, towerW: 6.6, canal: [-734, -330] };
export function barnabas(B, poly, q) {
  const O = obbOf(poly), { c, ux, uz } = O, L = O.L, W = O.W;
  // the aisles: the whole footprint as low walls (render, brick bands), a low-pitch roof band
  const aisleH = 6.4, naveH = 13.5, nw = Math.min(W * 0.55, 5.2);
  for (const f of faces(poly)) {
    B.push(faceFrame(f));
    B.poly('render0', [[-f.L / 2, 0, 0], [f.L / 2, 0, 0], [f.L / 2, aisleH, 0], [-f.L / 2, aisleH, 0]], [0, 0, 1], [[0, 0], [f.L, 0], [f.L, aisleH], [0, aisleH]]);
    if (q < 2) for (const y of [0.5, 3.3, aisleH - 0.3]) B.box('brick', 0, y, 0.03, Math.max(0.2, f.L - 0.02), 0.3, 0.06, 0, { bottom: true });
    if (q < 2 && f.L > 4.5) { const n = Math.floor(f.L / 3.4); for (let k = 0; k < n; k++) { const x = -f.L / 2 + (k + 0.5) * f.L / n; B.archUnit('arch', x, 1.0, 1.4, 3.0, 0.065, [200 + k + f.i * 7, 1], q ? 5 : 8); } }
    B.pop();
  }
  B.flat('tileRed', poly, aisleH);
  // the nave: a tall clerestory block down the long axis with a low gabled tile roof, round-headed clerestory lights
  B.push(frame(c[0], 0, c[1], ux, uz));      // local x along the nave, local z across
  const nl = L - 2.2;
  B.box('render0', 0, (aisleH + naveH) / 2, 0, nl * 2, naveH - aisleH, nw * 2, 0, { top: false });
  if (q < 2) for (const s of [-1, 1]) {
    B.push(frame(0, 0, s * (nw + 0.016), s, 0));
    const n = Math.floor(nl * 2 / 3.6); for (let k = 0; k < n; k++) { const x = -nl + (k + 0.5) * nl * 2 / n; B.archUnit('arch', x * s, 1.1, aisleH + 2.0, aisleH + 4.6, 0, [220 + k, 1], q ? 5 : 8); }
    B.pop();
    B.box('brick', 0, naveH - 0.3, s * (nw + 0.03), nl * 2, 0.35, 0.06, 0, { bottom: true });
  }
  const ridge = naveH + nw * 0.42;
  for (const s of [-1, 1]) B.poly('tileRed', [[-nl - 0.4, naveH, s * (nw + 0.5)], [nl + 0.4, naveH, s * (nw + 0.5)], [nl + 0.4, ridge, 0], [-nl - 0.4, ridge, 0]], [0, 1, s]);
  for (const e of [-1, 1]) B.poly('render0', [[e * nl, naveH, -nw], [e * nl, naveH, nw], [e * nl, ridge - 0.1, 0]], [e, 0, 0]);
  // a round west window in the nave gable (rose-like, lit)
  if (q < 2) for (const e of [-1, 1]) { B.push(frame(e * (nl + 0.01), 0, 0, 0, -e)); B.archUnit('arch', 0, 2.2, naveH - 3.2, naveH - 2.1, 0, [LIT[20 + (e > 0 ? 1 : 0)], 1], 10); B.pop(); }
  B.pop();
  // the campanile at the footprint's corner nearest the canal
  let tc = poly[0], bd = Infinity; for (const p of poly) { const d = Math.hypot(p[0] - BARNABAS.canal[0], p[1] - BARNABAS.canal[1]); if (d < bd) { bd = d; tc = p; } }
  const tw = BARNABAS.towerW, dx = c[0] - tc[0], dz = c[1] - tc[1], dl = Math.hypot(dx, dz), tx = tc[0] + dx / dl * (tw * 0.55), tz = tc[1] + dz / dl * (tw * 0.55);
  campanile(B, tx, tz, ux, uz, tw, BARNABAS.towerH, q);
  return { tower: [tx, tz] };
}
function campanile(B, x, z, ux, uz, w, H, q) {
  B.push(frame(x, 0, z, ux, uz));
  const st = [0, 13, 26, H - 6];          // stages: plain shaft, middle, upper, belfry
  B.box('render0', 0, (H - 0.6) / 2, 0, w, H - 0.6, w, 0, { top: false });
  // brick bands between the stages and corbel tables
  for (const y of [st[1], st[2], st[3], H - 0.8]) { B.box('brick', 0, y, 0, w + 0.24, 0.5, w + 0.24, 0, { bottom: true }); if (q === 0) for (let k = 0; k < 4; k++) { const t = k * Math.PI / 2; for (let i = 0; i < 8; i++) { const o = -w / 2 + (i + 0.5) * w / 8; B.box('brick', Math.sin(t) * (w / 2 + 0.15) + Math.cos(t) * o, y - 0.38, Math.cos(t) * (w / 2 + 0.15) - Math.sin(t) * o, 0.2, 0.26, 0.2, t); } } }
  if (q < 2) for (let k = 0; k < 4; k++) {
    const t = k * Math.PI / 2;
    B.push(frame(Math.sin(t) * (w / 2 + 0.016), 0, Math.cos(t) * (w / 2 + 0.016), Math.cos(t), -Math.sin(t)));
    // slit windows low down, paired round-headed lights in the middle stages, a triple belfry arcade on top
    B.archUnit('arch', 0, 0.5, 6, 8, 0, [DARK[k + 4], 1], 5);
    for (const sx of [-0.7, 0.7]) B.archUnit('arch', sx, 0.75, st[1] + 4, st[1] + 7.5, 0, [DARK[(k + 8) % 16], 1], q ? 5 : 7);
    for (const sx of [-0.8, 0.8]) B.archUnit('louvre', sx, 0.85, st[2] + 3.2, st[2] + 7.5, 0, [DARK[(k + 2) % 16], 1], q ? 5 : 7);
    for (const sx of [-1.75, 0, 1.75]) { B.archUnit('louvre', sx, 1.35, st[3] + 0.4, st[3] + 3.6, 0, [DARK[(k + 5) % 16], 1], q ? 5 : 8); if (q === 0 && sx !== 0) B.cyl('dress', sx - Math.sign(sx) * 0.88, st[3] + 0.3, 0.18, 0.12, 3.3, 6, true); }
    B.pop();
  }
  // the flattened roof of 1893: a shallow pyramid with wide eaves on brackets, a small cross
  const ey = H - 0.6, ov = 0.75;
  B.box('brick', 0, ey - 0.15, 0, w + ov * 2, 0.3, w + ov * 2, 0, { bottom: true });
  B.lathe('tileRed', 0, 0, [[(w / 2 + ov) * Math.SQRT2, ey], [0.05, ey + 2.6]], { seg: 4, a0: Math.PI / 4 });
  B.box('iron', 0, ey + 3.2, 0, 0.09, 1.3, 0.09, 0); B.box('iron', 0, ey + 3.45, 0, 0.6, 0.09, 0.09, 0);
  B.pop();
}

// ------------------------------------------------------------------------------------------------ the cinema
/** the Phoenix Picturehouse ("The Walton Cinema" under ?invented=1) on the mapped cinema's Walton Street front: pale blue render
 *  (photographs of 2009-13 show the whole front painted light blue, not cream: docs/research/photo_comparison.md), a raised centre, canopy */
export function cinema2(B, f, h, q) {
  const L = f.L, z = 0.13, hw = L / 2;
  B.push(faceFrame(f));
  B.box('render7', 0, (h + 0.5) / 2, 0.075, L + 0.1, h + 0.5, 0.11, 0, { top: true });
  const out = [[-hw * 0.4, h + 0.5], [hw * 0.4, h + 0.5], [hw * 0.4, h + 1.4], [hw * 0.25, h + 1.4], [hw * 0.25, h + 2.0], [-hw * 0.25, h + 2.0], [-hw * 0.25, h + 1.4], [-hw * 0.4, h + 1.4]];
  B.face('render7', out, [], z); B.face('render7', out, [], 0.03, true);
  const nw = Math.min(L * 0.62, 6.8), nh = nw / 8, ny = h - 1.6;
  B.box('boatBlue', 0, ny + nh / 2, z + 0.04, nw + 0.3, nh + 0.3, 0.08, 0);
  signAt(B, 'sign_jcinema', -nw / 2, nw / 2, ny, ny + nh, z + 0.085);
  if (q < 2) for (const s of [-1, 1]) for (let i = 0; i < 6; i++) glowCard(B, [s * (nw / 2 + 0.25) - 0.05, ny + i * nh / 5 - 0.05, z + 0.09], [s * (nw / 2 + 0.25) + 0.05, ny + i * nh / 5 - 0.05, z + 0.09], [s * (nw / 2 + 0.25) + 0.05, ny + i * nh / 5 + 0.05, z + 0.09], [s * (nw / 2 + 0.25) - 0.05, ny + i * nh / 5 + 0.05, z + 0.09], i + (s > 0 ? 7 : 0));
  const cd = 1.7, cy = 3.1, bw = Math.min(L - 1.6, 4.4), bh = bw / 8;
  B.box('boatBlue', 0, cy, (z + cd) / 2, Math.min(L - 0.8, 9), 0.22, cd - z, 0, { bottom: true });
  signAt(B, 'sign_jcinemaNow', -bw / 2, bw / 2, cy + 0.14, cy + 0.14 + bh, cd + 0.016);
  if (q < 2) for (let x = -Math.min(L - 0.8, 9) / 2 + 0.3, k = 0; x < Math.min(L - 0.8, 9) / 2; x += q ? 0.9 : 0.45, k++) glowCard(B, [x - 0.05, cy - 0.2, cd - 0.15], [x + 0.05, cy - 0.2, cd - 0.15], [x + 0.05, cy - 0.1, cd - 0.15], [x - 0.05, cy - 0.1, cd - 0.15], 30 + k);
  B.unit('glazed', rect(-1.6, 0, 1.6, 2.8), z + 0.016, [LIT[9], 0]);
  if (q < 2) for (const sx of [-1, 1]) { const x = sx * 2.7; if (Math.abs(x) + 0.5 < hw) signAt(B, sx > 0 ? 'muralB' : 'shutterB', x - 0.45, x + 0.45, 0.9, 2.3, z + 0.017); }
  if (q < 2 && h > 6) for (const sx of [-1, 1]) B.unit('sash', rect(sx * 2.6 - 0.55, h - 3.4, sx * 2.6 + 0.55, h - 1.9 - 0.1 * 0), z + 0.016, [sx > 0 ? 1 : 2, 2]);
  B.pop();
}

// ------------------------------------------------------------------------------------------------ the University Press
/**
 * The Press's Walton Street front (K: 1826-30, Daniel Robertson's centre and Edward Blore's wings: two wings joined by a
 * screen with a central monumental entrance, all in the Corinthian order — Historic England listing; G: the bay rhythm,
 * the attic, the gates). Drawn as a stone skin 0.35 m proud of the mapped walls of every street-facing face.
 * gateFace: the face that gets the arch.
 */
export function pressFront(B, fs, gateFace, h, q) {
  const top = h + 0.2;
  for (const f of fs) {
    const L = f.L, gate = f === gateFace, z = 0.36;
    B.push(faceFrame(f));
    B.box('stone', 0, top / 2, 0.18, L + 0.02, top, 0.34, 0, { top: true });
    // rusticated ground storey (dark joints), a plinth, a string course, the entablature and a balustraded parapet
    if (q < 2) { for (let y = 0.9; y < 4.4; y += 0.45) B.box('bridgeDk', 0, y, z + 0.016, L, 0.04, 0.02, 0); B.box('bridgeDk', 0, 0.3, z + 0.04, L + 0.05, 0.6, 0.1, 0, { top: true }); }
    B.box('dress', 0, 4.6, z + 0.06, L + 0.08, 0.3, 0.14, 0, { bottom: true });
    B.box('dress', 0, top - 0.5, z + 0.1, L + 0.2, 0.7, 0.22, 0, { bottom: true });
    if (q === 0) B.poly('dentil', [[-L / 2, top - 0.95, z + 0.232], [L / 2, top - 0.95, z + 0.232], [L / 2, top - 0.84, z + 0.232], [-L / 2, top - 0.84, z + 0.232]], [0, 0, 1], [[0, 0.02], [L, 0.02], [L, 0.98], [0, 0.98]]);
    B.box('dress', 0, top + 0.1, z - 0.05, L + 0.1, 0.2, 0.5, 0, { bottom: true });
    if (q < 2) { const n = Math.max(2, Math.floor(L / 0.45)); for (let k = 0; k < n; k++) B.cyl('dress', -L / 2 + (k + 0.5) * L / n, top + 0.2, z - 0.05, 0.1, 0.62, 5, false, 0.13); B.box('dress', 0, top + 0.88, z - 0.05, L + 0.1, 0.14, 0.45, 0); }
    // pilasters with capitals every bay; tall sashes in the upper storey, round-headed windows below
    const bays = Math.max(1, Math.round(L / 4.2)), bwid = L / bays;
    for (let k = 0; k <= bays; k++) { const x = -L / 2 + k * bwid; if (q < 2 || k % 2 === 0) { B.box('dress', x, (4.75 + top - 0.85) / 2, z + 0.08, 0.62, top - 0.85 - 4.75, 0.16, 0, { top: false }); if (q === 0) B.box('carve', x, top - 1.05, z + 0.12, 0.8, 0.36, 0.2, 0); } }
    if (q < 2) for (let k = 0; k < bays; k++) {
      const x = -L / 2 + (k + 0.5) * bwid;
      if (gate && Math.abs(x) < 3.2) continue;
      B.unit('sash', rect(x - 0.7, 5.6, x + 0.7, top - 1.6), z + 0.016, [k, 3]);
      B.archUnit('arch', x, 1.3, 1.2, 3.1, z + 0.016, [k + 40, 1], q ? 5 : 8);
      if (q === 0) B.box('dress', x, top - 1.42, z + 0.07, 1.8, 0.14, 0.12, 0);
    }
    if (gate) {
      // the monumental entrance: a tall arch between paired Corinthian columns, an attic over it, iron gates
      const aw = 4.2, ah = 7.2, col = (x) => { B.cyl('dress', x, 0.6, z + 0.5, 0.36, top - 1.5, q ? 8 : 12, false, 0.3); if (q < 2) B.box('carve', x, top - 1.1, z + 0.5, 0.86, 0.5, 0.86, 0); B.box('dress', x, 0.32, z + 0.5, 0.95, 0.64, 0.95, 0); };
      for (const sx of [-1, 1]) for (const o of [2.75, 3.75]) col(sx * o);
      B.box('dress', 0, top - 0.5, z + 0.5, 8.6, 0.7, 1.1, 0, { bottom: true });
      B.box('stone', 0, top + 1.1, z + 0.2, 8.8, 2.2, 0.8, 0, { top: true });
      if (q < 2) { signAt(B, 'sign_press', -2.6, 2.6, top + 0.55, top + 0.55 + 5.2 / 8, z + 0.605); }
      B.poly('shade', [[-aw / 2, 0.02, z + 0.01], [aw / 2, 0.02, z + 0.01], [aw / 2, ah - aw / 2, z + 0.01], [-aw / 2, ah - aw / 2, z + 0.01]], [0, 0, 1]);
      { const n = q ? 6 : 12; for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI, yb = ah - aw / 2; B.poly('shade', [[0, yb, z + 0.01], [Math.cos(a0) * aw / 2, yb + Math.sin(a0) * aw / 2, z + 0.01], [Math.cos(a1) * aw / 2, yb + Math.sin(a1) * aw / 2, z + 0.01]], [0, 0, 1]); B.box('dress', Math.cos((a0 + a1) / 2) * (aw / 2 + 0.2), yb + Math.sin((a0 + a1) / 2) * (aw / 2 + 0.2), z + 0.06, 0.45, 0.4, 0.14, 0); } }
      if (q < 2) { for (let x = -aw / 2 + 0.15; x < aw / 2; x += q ? 0.36 : 0.18) B.box('iron', x, 1.6, z + 0.12, 0.03, 3.2, 0.03, 0, { top: false }); B.box('iron', 0, 3.15, z + 0.12, aw, 0.06, 0.05, 0); B.box('iron', 0, 0.3, z + 0.12, aw, 0.05, 0.05, 0); }
    }
    B.pop();
  }
}

// ------------------------------------------------------------------------------------------------ Freud (St Paul's)
/**
 * The Greek Revival portico of the former St Paul's church on Walton Street (H. J. Underwood, 1836; the café-bar Freud
 * since 1988): photo comparison item 18 ("freud"). K: an Ionic portico in antis with a pediment in front of a plain
 * stone box, steps up, blue doors in a deep porch, blue railings to the pavement. G: every dimension (from the
 * photograph: about 8 m columns, the pediment a quarter of its width high), the depth the porch stands out from the
 * mapped wall (up to 3 m, the forecourt), four columns. Drawn on the mapped west face; returns the solid footprints
 * (world [x, z, w, d, rot] boxes and [x, z, r] circles).
 */
export function freudFront(B, f, D, q) {
  const W = f.L + 0.4, aw = 1.1, colH = 7.4, base = 0.45, eY = base + colH + 0.35;   // entablature from eY up
  const inner = W - 2 * aw, n = 4, cz = D - 0.55, solids = { boxes: [], circles: [] };
  B.push(faceFrame(f));
  // podium and three steps up to it from the forecourt
  B.box('dress', 0, base / 2, D / 2, W + 0.2, base, D, 0, { top: true });
  for (let k = 0; k < 3; k++) B.box('dress', 0, (k + 0.5) * base / 3, D + 0.35 * (3 - k) - 0.17, inner, base / 3 * (k + 1), 0.35, 0, { top: true });
  // the porch's back wall: dark (deep shade), the doors with their blue frame
  B.poly('shade', [[-inner / 2, base, 0.04], [inner / 2, base, 0.04], [inner / 2, eY, 0.04], [-inner / 2, eY, 0.04]], [0, 0, 1]);
  B.box('boatBlue', 0, base + 1.75, 0.1, 2.1, 3.5, 0.12, 0); B.box('door', 0, base + 1.45, 0.17, 1.6, 2.9, 0.04, 0);
  if (q < 2) B.box('boatBlue', 0, base + 3.85, 0.12, 2.3, 0.45, 0.14, 0);
  // antae: the side walls run forward to the column line, a pilaster capital on each
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - aw / 2);
    B.box('stone', x, (base + eY) / 2, D / 2, aw, eY - base, D, 0, { top: false });
    if (q < 2) B.box('carve', x, eY - 0.25, D / 2, aw + 0.12, 0.3, D + 0.1, 0);
    solids.boxes.push([x, D / 2, D, aw]);       // (collider boxes: width across the face, depth along it)
  }
  // four Ionic columns: moulded base, tapering shaft, volute capital and abacus
  const seg = q === 0 ? 14 : q === 1 ? 8 : 6;
  for (let k = 0; k < n; k++) {
    const x = -inner / 2 + (k + 0.5) * inner / n, r = Math.min(0.42, inner / n * 0.22);
    B.box('dress', x, base + 0.14, cz, r * 2.5, 0.28, r * 2.5, 0);
    B.cyl('stone', x, base + 0.28, cz, r * 0.84, colH - 0.6, seg, false, r);
    if (q < 2) { B.box('carve', x, base + colH - 0.18, cz, r * 3.0, 0.36, r * 1.7, 0); B.box('dress', x, base + colH + 0.06, cz, r * 2.6, 0.14, r * 2.6, 0); }
    if (q === 0) for (const sx of [-1, 1]) B.cyl('carve', x + sx * r * 1.32, base + colH - 0.34, cz + r * 0.86, 0.16, 0.32, 6, true, 0.16);
    solids.circles.push([x, cz, r + 0.05]);
  }
  // entablature (architrave, frieze, cornice) over the whole front and back to the wall
  B.box('dress', 0, eY + 0.3, D / 2, W + 0.2, 0.6, D + 0.2, 0, { bottom: true });
  B.box('stone', 0, eY + 0.9, D / 2, W + 0.2, 0.6, D + 0.2, 0, { bottom: false });
  B.box('dress', 0, eY + 1.33, D / 2 + 0.1, W + 0.8, 0.26, D + 0.6, 0, { bottom: true });
  if (q === 0) B.poly('dentil', [[-W / 2 - 0.1, eY + 1.1, D + 0.205], [W / 2 + 0.1, eY + 1.1, D + 0.205], [W / 2 + 0.1, eY + 1.2, D + 0.205], [-W / 2 - 0.1, eY + 1.2, D + 0.205]], [0, 0, 1], [[0, 0.02], [W, 0.02], [W, 0.98], [0, 0.98]]);
  // the pediment: tympanum, raking cornices, a low lead roof back to the wall
  const pY = eY + 1.46, pH = (W + 0.8) / 2 * 0.3, zf = D + 0.3;
  B.poly('stone', [[-W / 2 - 0.3, pY, zf - 0.12], [W / 2 + 0.3, pY, zf - 0.12], [0, pY + pH - 0.2, zf - 0.12]], [0, 0, 1]);
  for (const sx of [-1, 1]) {
    B.beam('dress', [sx * (W / 2 + 0.45), pY + 0.05, zf], [0, pY + pH, zf], 0.32, 0.26);
    B.poly('lead', [[sx * (W / 2 + 0.45), pY + 0.08, zf], [0, pY + pH + 0.1, zf], [0, pY + pH + 0.1, -0.05], [sx * (W / 2 + 0.45), pY + 0.08, -0.05]], [sx * 0.3, 1, 0]);
  }
  B.poly('stone', [[W / 2 + 0.3, pY, -0.04], [-W / 2 - 0.3, pY, -0.04], [0, pY + pH - 0.2, -0.04]], [0, 0, -1]);
  B.pop();
  // footprints in world coordinates
  const w = (x, z) => [f.mx + f.ux * x + f.nx * z, f.mz + f.uz * x + f.nz * z], rot = Math.atan2(f.ux, f.uz);
  return { boxes: solids.boxes.map(([x, z, a, d]) => { const p = w(x, z); return [p[0], p[1], a, d, rot]; }), circles: solids.circles.map(([x, z, r]) => { const p = w(x, z); return [p[0], p[1], r]; }), podium: (() => { const p = w(0, D / 2); return [p[0], p[1], D, W, rot, base]; })() };
}

// ------------------------------------------------------------------------------------------------ narrowboats
/**
 * A narrowboat ~ L m (G: the boats, names, liveries invented; 2.1 m beam as on the Oxford Canal): steel hull (black
 * below, a coloured cabin side with portholes and coachlines), a cratch at the bow, a stove chimney, plants and a bike on
 * the roof, the tiller at the stern. At (x, z), heading h (bow direction). k picks livery / name.
 */
export const BOATS = [['boatGreen', 'portGreen', 'sign_boatA'], ['boatRed', 'portRed', 'sign_boatB'], ['boatBlue', 'portBlue', 'sign_boatC'], ['boatBlack', 'portCream', 'sign_boatD']];
export function narrowboat(B, x, z, h, L, k, q) {
  const [hullC, side, name] = BOATS[k % BOATS.length], hw = 1.05, y0 = -0.35;
  B.push(frame(x, 0, z, Math.cos(h), -Math.sin(h)));       // local +z = bow
  const hl = L / 2;
  // hull: black, a pointed bow, a rounded counter at the stern
  const out = [[-hw, -hl + 0.6], [hw, -hl + 0.6], [hw, hl - 2.2], [0, hl], [-hw, hl - 2.2]];
  for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; B.poly('boatBlack', [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], 0.55, b[1]], [a[0], 0.55, a[1]]], [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2 + 0.01]); }
  B.flat('deck', out.map(([px, pz]) => [px, pz]), 0.55);
  B.box(hullC, 0, 0.6, -hl + 0.3, hw * 1.6, 0.5, 0.6, 0);
  // cabin: 0.75 m tall, the length minus bow well and stern deck, cabin sides with portholes
  const c0 = -hl + 1.6, c1 = hl - 3.0, ch = 1.38, cl = c1 - c0;
  B.box(hullC, 0, (0.55 + ch) / 2, (c0 + c1) / 2, hw * 1.86, ch - 0.55, cl, 0, { top: false });
  B.box('boatCream', 0, ch + 0.03, (c0 + c1) / 2, hw * 1.96, 0.06, cl + 0.1, 0);
  if (q < 2) for (const s of [-1, 1]) {
    const n = Math.max(1, Math.floor(cl / 3));
    B.push(frame(s * (hw * 0.93 + 0.016), 0, (c0 + c1) / 2, 0, -s));      // local x = the viewer's right, +z = out of that side
    for (let i = 0; i < n; i++) { const xx = -cl / 2 + (i + 0.5) * cl / n; B.unit(side, rect(xx - 1.3, 0.62, xx + 1.3, ch - 0.06), 0.0, [LIT[(k * 5 + i + (s > 0 ? 2 : 0)) % LIT.length] + (i % 3 === 2 ? 1 : 0), 0]); }
    if (s > 0 || q === 0) signAt(B, name, -1.4, 1.4, 0.82, 0.82 + 2.8 / 8, 0.028);
    B.pop();
  }
  // the cratch (a triangular board and cover over the bow well), the stove chimney with its brass bands, the tiller
  B.poly('canvas', [[-hw * 0.85, 0.55, c1], [hw * 0.85, 0.55, c1], [0, 1.3, c1 + 0.2]], [0, 0, 1]);
  B.poly('canvas', [[hw * 0.85, 0.55, c1], [0, 0.55, hl - 0.8], [0, 1.3, c1 + 0.2]], [1, 0.3, 0.3]); B.poly('canvas', [[0, 0.55, hl - 0.8], [-hw * 0.85, 0.55, c1], [0, 1.3, c1 + 0.2]], [-1, 0.3, 0.3]);
  B.cyl('boatBlack', 0.4, ch, c1 - 1.2, 0.07, 0.6, 6, true); if (q === 0) B.cyl('brass', 0.4, ch + 0.5, c1 - 1.2, 0.075, 0.06, 6, false);
  if (q < 2) B.beam('brass', [0, 0.95, -hl + 0.5], [0, 1.15, -hl - 0.4], 0.05);
  // roof clutter: plant pots, a coil of rope, a bike on some boats, a pole and plank
  if (q === 0) {
    for (let i = 0; i < 2 + (k % 2); i++) { const zz = c0 + 1.2 + i * 1.1; B.cyl('pot', -0.3, ch + 0.06, zz, 0.2, 0.25, 6, true); B.cyl('foliage', -0.3, ch + 0.3, zz, 0.12, 0.22, 6, true, 0.26); }
    B.beam('oak', [0.55, ch + 0.1, c0 + 0.4], [0.55, ch + 0.1, c1 - 0.4], 0.07);
    if (k % 2 === 0) { B.push(frame(0, ch + 0.07, (c0 + c1) / 2 + 1, 1, 0)); bike(B, 0, 0, Math.PI / 2, 'navy', 1); B.pop(); }
  }
  B.pop();
}

/** white cast-iron parapets on a mapped footbridge: two arched lattice rails along a..b (G) */
export function bridgeRails(B, a, b, w, q) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz, nz = ux, n = q ? 8 : 16;
  for (const s of [-1, 1]) {
    const P = (t, y) => [a[0] + ux * L * t + nx * s * w / 2, y + Math.sin(t * Math.PI) * 0.35, a[1] + uz * L * t + nz * s * w / 2];
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; B.beam('white', P(t0, 1.1), P(t1, 1.1), 0.07); B.beam('white', P(t0, 0.15), P(t1, 0.15), 0.06); if (q === 0) { B.beam('white', P(t0, 0.15), P(t1, 1.1), 0.03); B.beam('white', P(t0, 1.1), P(t1, 0.15), 0.03); } B.beam('white', P(t0, 0.1), P(t0, 1.12), 0.05); }
    B.beam('white', P(1, 0.1), P(1, 1.12), 0.06);
  }
}
export { bulb, TAU, prismN };
