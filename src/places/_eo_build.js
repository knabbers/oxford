// Geometry for the Cowley Road pass (owned by places/cowley_road.js) — see docs/research/east_oxford_jericho.md.
// Everything goes into Batches of the shared batch-4 atlas (one draw for all of it, _b4_kit.js). Builders take the
// mapped footprints (game.map) so the pieces sit on the real buildings; `q` is the LOD level (0 near, 1 mid, 2 far).
import { EASTPASS } from '../world/terrain.js';
import { RB, TAU, frame, prismN, glowCard, bulb, bike, stand, festoon, LIT, DARK } from './_b4_kit.js';
import { faces, faceFrame, centroid, units, offCarriage, offBuildings } from './_eo_kit.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const UV = [0.004, 0.004, 0.996, 0.996];
/** a sign card in a face-local frame (facing +z) at z, x0..x1, y0..y1 */
export const signAt = (B, key, x0, x1, y0, y1, z) => B.card(key, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], UV);
/** a row of bulbs along local x at (y, z) */
function bulbRow(B, x0, x1, y, z, step, k = 0, s = 0.05) { for (let x = x0, i = 0; x <= x1 + 1e-6; x += step, i++) glowCard(B, [x - s, y - s, z], [x + s, y - s, z], [x + s, y + s, z], [x - s, y + s, z], k + i); }

// ------------------------------------------------------------------------------------------------ the cinema
/**
 * The Ultimate Picture Palace ("The Empress" under ?invented=1) on the mapped cinema in Jeune Street: a white rendered Edwardian front over the city
 * wall, a stepped parapet, a small tower over the entrance carrying the name between rows of bulbs, and a canopy with the
 * lit "now showing" board (G: the form is the brief's "small tower marquee"; details invented).
 */
export function cinemaFront(B, f, h, q) {
  if (!EASTPASS) return cinemaFrontOld(B, f, h, q);
  // (photo comparison east, 2026-11: the 2013 photographs show a LOW white front — a four-column portico carrying a
  // deep entablature with the name across it, a dentil cornice and a broad segmental gable above — not the tower with
  // a dome this used to be. Widths and heights are read off the photographs: a GUESS to a few decimetres.)
  const L = f.L, z = 0.14, hw = L / 2, W = Math.min(L - 0.6, 12.5), pw = W / 2, c0 = 4.55, c1 = 5.5, pd = 1.9;
  B.push(faceFrame(f));
  B.box('render6', 0, (h + 0.5) / 2, 0.08, L + 0.12, h + 0.5, 0.12, 0, { top: true });
  // the segmental gable over the cornice, with low shoulders (front and back faces)
  const out = [[-hw, c1], [hw, c1], [hw, h + 0.5], [pw * 0.86, h + 0.5]];
  const top = Math.max(h + 2.4, c1 + 3.2), N = q ? 8 : 14;
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI, e = Math.sin(a); out.push([Math.cos(a) * pw * 0.86, h + 0.5 + e * (top - h - 0.5)]); }
  out.push([-pw * 0.86, h + 0.5], [-hw, h + 0.5]);
  B.face('render6', out, [], z); B.face('render6', out, [], 0.02, true);
  // the portico: four columns, the entablature with the name, the dentil cornice
  for (const x of [-pw + 0.45, -pw * 0.34, pw * 0.34, pw - 0.45]) {
    B.cyl('white', x, 0.18, pd, 0.2, c0 - 0.18, q ? 6 : 10, false, 0.24); B.box('white', x, 0.09, pd, 0.66, 0.18, 0.66, 0); B.box('white', x, c0 - 0.07, pd, 0.6, 0.14, 0.6, 0);
  }
  B.box('white', 0, (c0 + c1) / 2, (z + pd + 0.3) / 2, W, c1 - c0, pd + 0.3 - z, 0, { bottom: true, top: true });
  B.box('white', 0, c1 + 0.11, (z + pd + 0.55) / 2, W + 0.5, 0.22, pd + 0.55 - z, 0, { bottom: true, top: true });
  if (q === 0) for (let k = 0, n = Math.floor(W / 0.36); k < n; k++) B.box('white', -pw + 0.18 + k * (W / n), c1 - 0.09, pd + 0.36, 0.16, 0.16, 0.12, 0);
  const nh = Math.min(0.62, (W - 1.2) / 9), nw = nh * 8, ny = (c0 + c1) / 2 - nh / 2;
  signAt(B, 'sign_cinema', -nw / 2, nw / 2, ny, ny + nh, pd + 0.165);
  if (q < 2) bulbRow(B, -pw + 0.5, pw - 0.5, c0 - 0.1, pd - 0.25, q ? 0.9 : 0.45, 3);
  // under the portico: the pay box window, doors either side, poster cases and the "now showing" board
  B.unit('glazed', rect(-0.9, 0.9, 0.9, 2.5), z + 0.016, [LIT[5], 0]);
  for (const sx of [-1, 1]) { const x = sx * pw * 0.66; B.unit('doorOak', rect(x - 0.95, 0, x + 0.95, 2.9), z + 0.016, [0, 0]); }
  if (q < 2) for (const sx of [-1, 1]) { const x = sx * 1.55; B.box('dark', x, 1.75, z + 0.04, 0.8, 1.3, 0.06, 0); signAt(B, sx > 0 ? 'muralA' : 'muralB', x - 0.34, x + 0.34, 1.2, 2.3, z + 0.075); }
  const bw = Math.min(W * 0.4, 3.6), bh = bw / 8;
  B.box('dark', 0, 3.3 + bh / 2, z + 0.04, bw + 0.2, bh + 0.12, 0.06, 0);
  signAt(B, 'sign_cinemaNow', -bw / 2, bw / 2, 3.3, 3.3 + bh, z + 0.075);
  // chequered step
  B.box('dress', 0, 0.06, (z + pd + 0.4) / 2, W + 0.2, 0.12, pd + 0.4 - z, 0, { bottom: false });
  B.pop();
}

/** the front as it was before the east photo pass (a tower with a dome: a guess the photographs refuted); only under ?eastpass=0 */
function cinemaFrontOld(B, f, h, q) {
  const L = f.L, z = 0.14, hw = L / 2;
  B.push(faceFrame(f));
  B.box('render6', 0, (h + 0.7) / 2, 0.08, L + 0.12, h + 0.7, 0.12, 0, { top: true });
  // stepped parapet with a round-topped centre (front and back faces)
  const out = [[-hw, h + 0.7], [hw, h + 0.7], [hw, h + 1.3], [hw * 0.55, h + 1.3], [hw * 0.55, h + 1.9], [hw * 0.3, h + 1.9]];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; out.push([Math.cos(a) * hw * 0.3, h + 1.9 + Math.sin(a) * 1.1]); }
  out.push([-hw * 0.3, h + 1.9], [-hw * 0.55, h + 1.9], [-hw * 0.55, h + 1.3], [-hw, h + 1.3]);
  B.face('render6', out, [], z); B.face('render6', out, [], 0.02, true);
  if (q < 2) for (const y of [3.05, h - 0.2]) B.box('white', 0, y, z + 0.06, L + 0.2, 0.18, 0.12, 0, { bottom: true });
  // the tower over the door: render, a name panel framed by bulbs, a small lead dome and a mast
  const tw = Math.min(4.2, L * 0.42), t0 = 3.6, t1 = h + 4.6, tz0 = z, tz1 = 1.1;
  B.box('render6', 0, (t0 + t1) / 2, (tz0 + tz1) / 2, tw, t1 - t0, tz1 - tz0, 0, { top: true, bottom: true });
  const ny = h + 2.6, nh = Math.min(0.62, (tw - 0.3) / 8), nw = nh * 8;
  B.box('dark', 0, ny + nh / 2, tz1 + 0.04, nw + 0.3, nh + 0.34, 0.08, 0);
  signAt(B, 'sign_cinema', -nw / 2, nw / 2, ny, ny + nh, tz1 + 0.095);
  if (q < 2) { bulbRow(B, -nw / 2, nw / 2, ny - 0.1, tz1 + 0.1, q ? 0.5 : 0.25, 3); bulbRow(B, -nw / 2, nw / 2, ny + nh + 0.1, tz1 + 0.1, q ? 0.5 : 0.25, 9); }
  if (q < 2) for (const sx of [-1, 1]) { B.box('white', sx * (tw / 2 - 0.15), (t0 + t1) / 2 + 0.01, tz1 + 0.03, 0.24, t1 - t0 - 0.06, 0.06, 0); }
  B.lathe('lead', 0, (tz0 + tz1) / 2, [[tw * 0.42, t1], [tw * 0.36, t1 + 0.6], [tw * 0.2, t1 + 1.05], [0.05, t1 + 1.25]], { seg: q ? 6 : 10 });
  B.cyl('iron', 0, t1 + 1.2, (tz0 + tz1) / 2, 0.03, 1.6, 4, false);
  // tall arched windows in the tower (lit at night: the stair)
  if (q < 2) B.archUnit('arch', 0, 1.1, t0 + 2.4, t0 + 5.0, tz1 + 0.01, [LIT[2], 1], q ? 5 : 8);
  // upper windows either side: three sashes per floor
  if (q < 2) for (const sx of [-1, 1]) for (const y0 of [4.6, 8.0]) if (y0 + 1.8 < h) for (let k = 0; k < 2; k++) { const x = sx * (tw / 2 + 0.9 + k * 1.9); if (Math.abs(x) + 0.6 < hw - 0.3) B.unit('sash', rect(x - 0.55, y0, x + 0.55, y0 + 1.8), z + 0.016, [k + (sx > 0 ? 3 : 0), 1 + y0]); }
  // the canopy and its "now showing" board, bulbs underneath
  const cd = 2.0, cy = 3.3;
  B.box('dark', 0, cy, (z + cd) / 2, L - 0.6, 0.24, cd - z, 0, { bottom: true });
  const bw = Math.min(L - 1.4, 4.6), bh = bw / 8;
  B.box('dark', 0, cy + 0.12 + bh / 2 + 0.06, cd - 0.05, bw + 0.2, bh + 0.12, 0.08, 0);
  signAt(B, 'sign_cinemaNow', -bw / 2, bw / 2, cy + 0.18, cy + 0.18 + bh, cd + 0.016);
  if (q < 2) bulbRow(B, -L / 2 + 0.6, L / 2 - 0.6, cy - 0.16, cd - 0.15, q ? 0.9 : 0.45, 20);
  // doors and two poster cases
  B.unit('glazed', rect(-1.7, 0, 1.7, 2.9), z + 0.016, [LIT[5], 0]);
  if (q < 2) for (const sx of [-1, 1]) { const x = sx * (tw / 2 + 1.2); if (Math.abs(x) + 0.6 < hw) { B.box('dark', x, 1.6, z + 0.04, 1.0, 1.5, 0.06, 0); signAt(B, sx > 0 ? 'muralA' : 'muralB', x - 0.42, x + 0.42, 0.95, 2.25, z + 0.075); } }
  B.pop();
}

// ------------------------------------------------------------------------------------------------ the music venue
/** the O2 Academy ("The East Ballroom" under ?invented=1) on the mapped venue's Cowley Road front: black front, big fascia, lit gig board */
export function venueFront(B, f, h, q) {
  const L = Math.min(f.L, 26), z = 0.12;
  B.push(faceFrame(f));
  B.box('boatBlack', 0, 2.1, 0.07, L, 4.2, 0.1, 0, { top: true });
  const fw = Math.min(L - 1, 12), fh = fw / 8;
  B.box('dark', 0, 4.3 + fh / 2, z + 0.05, fw + 0.4, fh + 0.4, 0.12, 0, { bottom: true });
  signAt(B, 'sign_venue', -fw / 2, fw / 2, 4.3, 4.3 + fh, z + 0.115);
  if (q < 2) { bulbRow(B, -fw / 2, fw / 2, 4.12, z + 0.12, q ? 0.8 : 0.4, 30); bulbRow(B, -fw / 2, fw / 2, 4.3 + fh + 0.18, z + 0.12, q ? 0.8 : 0.4, 50); }
  // canopy with the gig board
  const cd = 1.8, cy = 3.15;
  B.box('dark', 0, cy, (z + cd) / 2, Math.min(L - 1, 10), 0.22, cd - z, 0, { bottom: true });
  const bw = Math.min(L - 1.6, 6.4), bh = bw / 8;
  signAt(B, 'sign_venueGig', -bw / 2, bw / 2, cy + 0.15, cy + 0.15 + bh, cd + 0.016);
  if (q < 2) bulbRow(B, -4.5, 4.5, cy - 0.15, cd - 0.15, q ? 1.0 : 0.5, 60);
  // doors (lit foyer), a cash window, gig posters
  B.unit('glazed', rect(-2.2, 0, 2.2, 2.8), z + 0.016, [LIT[7], 0]);
  if (q < 2) for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) { const x = sx * (3.2 + k * 1.3); if (Math.abs(x) + 0.6 < L / 2) signAt(B, (k + (sx > 0 ? 1 : 0)) % 2 ? 'shutterA' : 'muralA', x - 0.5, x + 0.5, 0.9, 2.3, z + 0.017); }
  B.pop();
}

// ------------------------------------------------------------------------------------------------ the community arts centre
/** the mural and lettering on the community centre's street face (mural invented, generic) */
export function artsFront(B, f, h, q) {
  const L = f.L, z = 0.05;
  B.push(faceFrame(f));
  const mw = Math.min(L - 1.2, 16), mh = Math.min(h - 3.6, mw / 2);
  signAt(B, 'muralA', -mw / 2, mw / 2, 3.4, 3.4 + mh, z);
  if (q < 2) { const sw = Math.min(mw, 7.2), sh = sw / 8; B.box('white', 0, 2.55 + sh / 2, z + 0.04, sw + 0.3, sh + 0.2, 0.06, 0); signAt(B, 'sign_arts', -sw / 2, sw / 2, 2.55, 2.55 + sh, z + 0.075); }
  B.pop();
}
/** the record shop's own fascia board (over the world's) and a projecting sign on a bracket */
export function recordsSign(B, f) {
  const w = Math.min(f.L - 0.6, 5.6), h = w / 8, y = 3.05;
  B.push(faceFrame(f));
  B.box('boatGreen', 0, y + h / 2, 0.1, w + 0.24, h + 0.2, 0.12, 0, { bottom: true });
  signAt(B, 'sign_records', -w / 2, w / 2, y, y + h, 0.176);
  const bx = f.L / 2 - 0.6; B.beam('iron', [bx, 4.4, 0.02], [bx, 4.4, 1.1], 0.05);
  B.box('boatGreen', bx, 3.95, 0.75, 0.06, 0.8, 0.8, 0);
  B.push(frame(bx + 0.05, 0, 0.75, 0, -1)); signAt(B, 'sign_records', -0.38, 0.38, 3.9, 3.995, 0.0); B.pop();
  B.pop();
}
/** a second mural on another wall (bottom half of the mural cell) */
export function muralOn(B, f, h, key = 'muralB') {
  const L = f.L, mw = Math.min(L - 1, 14), mh = Math.min(h - 1.6, mw / 2);
  B.push(faceFrame(f)); signAt(B, key, -mw / 2, mw / 2, 0.9, 0.9 + mh, 0.05); B.pop();
}

// ------------------------------------------------------------------------------------------------ the mosque
/**
 * The mosque on Manzil Way, rebuilt on its mapped footprint (K: red, blue and buff brick, a minaret at the front, slim
 * corner turrets with dome caps and a large central dome — Oxford City Council heritage nomination; G: every dimension,
 * the dome's colour, the windows). Exterior only.
 */
export const MOSQUE = { id: 'w71223414', wallH: 7.4, minaret: [1994.4, 816.6], minH: 24, main: [[2012.5, 790.9], [2037.5, 812.9], [2019.3, 833.3], [1997.8, 814.5]] };
export function mosque(B, poly, q) {
  const H = MOSQUE.wallH;
  for (const f of faces(poly)) {
    B.push(faceFrame(f));
    B.poly('mosqueRed', [[-f.L / 2, 0, 0], [f.L / 2, 0, 0], [f.L / 2, H, 0], [-f.L / 2, H, 0]], [0, 0, 1], [[0, 0], [f.L, 0], [f.L, H], [0, H]]);
    if (q < 2 && f.L > 1.5) for (const [y, key] of [[0.9, 'mosqueBuff'], [2.9, 'mosqueBlue'], [3.25, 'mosqueBuff'], [5.9, 'mosqueBlue'], [H - 0.4, 'mosqueBuff']]) B.box(key, 0, y, 0.03, f.L + 0.04, y === H - 0.4 ? 0.66 : 0.28, 0.06, 0, { bottom: true });
    // tall round-headed windows on the longer faces (lit after dark)
    if (q < 2 && f.L > 9) { const n = Math.floor(f.L / 3.6); for (let k = 0; k < n; k++) { const x = -f.L / 2 + (k + 0.5) * f.L / n; B.archUnit('arch', x, 1.15, 3.7, 5.2, 0.07, [100 + k + f.i * 9, 1], q ? 5 : 8); } }
    B.pop();
  }
  // roof, cornice
  const flat = (key, pts, y) => B.flat(key, pts, y);
  flat('lead', poly, H);
  // the central dome on an octagonal drum over the prayer hall
  const [cx, cz] = centroid(MOSQUE.main), R = 5.6;
  prismN(B, 'mosqueBuff', cx, cz, R + 0.5, 8, H, H + 2.2, Math.PI / 8, true);
  if (q < 2) for (let i = 0; i < 8; i++) { const t = Math.PI / 8 + (i + 0.5) * TAU / 8, ap = (R + 0.5) * Math.cos(Math.PI / 8) + 0.01; B.push(frame(cx + Math.sin(t) * ap, 0, cz + Math.cos(t) * ap, Math.cos(t), -Math.sin(t))); B.archUnit('arch', 0, 1.1, H + 0.4, H + 1.35, 0, [120 + i, 1], 6); B.pop(); }
  const seg = q === 2 ? 8 : q ? 12 : 20, prof = [];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; prof.push([R * Math.cos(a) * (1 + (EASTPASS ? 0.16 : 0.06) * Math.sin(a * 2)), H + 2.2 + R * (EASTPASS ? 1.12 : 1.05) * Math.sin(a)]); }   // (a fuller, onion-shouldered dome: the 2009 photograph)
  prof[prof.length - 1][0] = 0.02;
  B.lathe(EASTPASS ? 'boatOx' : 'domeGreen', cx, cz, prof, { seg });                 // dark weathered copper-brown, not green (photo comparison east; the old colour was a guess)
  const top = H + 2.2 + R * (EASTPASS ? 1.12 : 1.05);
  crescent(B, cx, top, cz, 0.9, q);
  // the minaret at the front: octagonal shaft, a balcony, a lantern stage, a pointed dome
  const [mx, mz] = MOSQUE.minaret, r = 1.45, mH = MOSQUE.minH;
  prismN(B, 'mosqueRed', mx, mz, r, 8, 0, mH - 6, Math.PI / 8, false);
  if (q < 2) for (const y of [3, 7, 11, 15]) prismN(B, 'mosqueBuff', mx, mz, r + 0.04, 8, y, y + 0.4, Math.PI / 8, false);
  prismN(B, 'mosqueBuff', mx, mz, r + 0.7, 8, mH - 6, mH - 5.6, Math.PI / 8, true);
  if (q < 2) for (let i = 0; i < 8; i++) { const t0 = Math.PI / 8 + (i / 8) * TAU, t1 = Math.PI / 8 + ((i + 1) / 8) * TAU, R2 = r + 0.65; B.beam('white', [mx + Math.sin(t0) * R2, mH - 4.7, mz + Math.cos(t0) * R2], [mx + Math.sin(t1) * R2, mH - 4.7, mz + Math.cos(t1) * R2], 0.06); B.cyl('white', mx + Math.sin(t0) * R2, mH - 5.6, mz + Math.cos(t0) * R2, 0.04, 0.9, 4, false); }
  prismN(B, 'mosqueBlue', mx, mz, r * 0.8, 8, mH - 5.6, mH - 2.4, Math.PI / 8, false);
  if (q < 2) for (let i = 0; i < 8; i += 2) { const t = Math.PI / 8 + (i + 0.5) * TAU / 8, ap = r * 0.8 * Math.cos(Math.PI / 8) + 0.01; B.push(frame(mx + Math.sin(t) * ap, 0, mz + Math.cos(t) * ap, Math.cos(t), -Math.sin(t))); B.archUnit('arch', 0, 0.6, mH - 5.2, mH - 3.6, 0, [LIT[11 + i], 1], 5); B.pop(); }
  B.lathe('domeGreen', mx, mz, [[r * 0.95, mH - 2.4], [r * 0.9, mH - 1.6], [r * 0.55, mH - 0.6], [0.04, mH + 0.4]], { seg: q ? 8 : 12 });
  crescent(B, mx, mH + 0.4, mz, 0.5, q);
  // slim corner turrets with dome caps at the prayer hall's corners
  for (const [x, z] of MOSQUE.main) {
    const ux = cx - x, uz = cz - z, d = Math.hypot(ux, uz), tx = x + ux / d * 0.6, tz = z + uz / d * 0.6;
    prismN(B, 'mosqueBuff', tx, tz, 0.55, 8, 0, H + 2.2, 0, false);
    B.lathe('domeGreen', tx, tz, [[0.7, H + 2.2], [0.62, H + 2.7], [0.3, H + 3.2], [0.02, H + 3.5]], { seg: q ? 6 : 8 });
    if (q < 2) B.cyl('domeGold', tx, H + 3.45, tz, 0.03, 0.5, 4, false);
  }
}
/** a gold finial: a sphere and a crescent (two thin arcs facing east-west) */
function crescent(B, x, y, z, s, q) {
  B.lathe('domeGold', x, z, [[0.03, y], [0.08 * s, y + 0.1 * s], [0.16 * s, y + 0.28 * s], [0.08 * s, y + 0.46 * s], [0.03, y + 0.52 * s]], { seg: q ? 5 : 8 });
  B.cyl('domeGold', x, y + 0.5 * s, z, 0.025, 0.4 * s, 4, false);
  if (q === 2) return;
  const n = q ? 5 : 9, R = 0.34 * s, cy = y + 1.15 * s;
  for (let i = 0; i < n; i++) { const a0 = -Math.PI * 0.85 + (i / n) * Math.PI * 1.7, a1 = -Math.PI * 0.85 + ((i + 1) / n) * Math.PI * 1.7; B.beam('domeGold', [x + Math.cos(a0 + Math.PI / 2) * R * 0.0, cy + Math.sin(a0 + Math.PI / 2) * R, z + Math.cos(a0 + Math.PI / 2) * R], [x, cy + Math.sin(a1 + Math.PI / 2) * R, z + Math.cos(a1 + Math.PI / 2) * R], 0.06 * s + 0.02); }
}

// ------------------------------------------------------------------------------------------------ the church tower
/**
 * The Methodist church on the Cowley Road at Jeune Street (photo comparison east, 2026-11; two photographs of 2012-14):
 * a gabled stone front with one great Perpendicular window over the door, an octagonal turret with a lead spirelet at
 * its right-hand corner and a lesser pinnacled stair turret at the left. G: every dimension.
 */
export const METHODIST = { id: 'w123657459' };
export function methodistFront(B, f, q) {
  const W = Math.min(f.L - 0.4, 11.5), hw = W / 2, e = 8.6, apex = 13.4, z = 0.3;
  B.push(faceFrame(f));
  const out = [[-hw, 0], [hw, 0], [hw, e], [0, apex], [-hw, e]];
  B.face('rubble', out, [], z); B.face('rubble', out, [], 0.02, true);
  for (const sx of [-1, 1]) B.poly('dress', [[sx * hw, e, z + 0.06], [0, apex, z + 0.06], [0, apex + 0.3, z + 0.06], [sx * (hw + 0.2), e + 0.25, z + 0.06]], [0, 0, 1]);
  B.box('rubble', 0, e / 2, z / 2, W, e, z, 0, { top: true });
  if (q < 2) { B.unit('perp', rect(-2.3, 4.3, 2.3, 9.4), z + 0.012, [0, 0]); B.archUnit('arch', 0, 2.3, 0, 3.5, z + 0.012, [DARK[1], 0], q ? 5 : 8); for (const sx of [-1, 1]) B.unit('perp', rect(sx * 3.9 - 0.7, 1.4, sx * 3.9 + 0.7, 3.4), z + 0.012, [0, 0]); B.box('dress', 0, 3.9, z + 0.05, W, 0.22, 0.1, 0, { bottom: true }); }
  // the octagonal turret (belfry lights, a lead spirelet) and the stair turret with its stone cap
  const tx = hw + 0.7, tz = -1.1, th = 14.6;
  prismN(B, 'rubble', tx, tz, 1.75, 8, 0, th, Math.PI / 8, false);
  B.cyl('dress', tx, th, tz, 1.9, 0.3, 8, true, 1.9);
  if (q < 2) for (let k = 0; k < 8; k += 2) { const t = k * TAU / 8; B.push(frame(tx + Math.sin(t) * 1.63, 0, tz + Math.cos(t) * 1.63, Math.cos(t), -Math.sin(t))); B.archUnit('louvre', 0, 0.7, th - 4.4, th - 1.2, 0, [DARK[k % DARK.length], 1], 5); B.pop(); }
  B.lathe('lead', tx, tz, [[1.55, th + 0.3], [0.9, th + 1.6], [0.32, th + 3.6], [0.03, th + 5.2]], { seg: 8 });
  const sx = -hw - 0.3, sh = 9.8;
  prismN(B, 'rubble', sx, tz + 0.4, 1.05, 8, 0, sh, Math.PI / 8, false);
  B.lathe('dress', sx, tz + 0.4, [[1.15, sh], [0.75, sh + 0.9], [0.25, sh + 2.2], [0.03, sh + 2.9]], { seg: 8 });
  B.pop();
}

/**
 * The tower of St Mary and St John (K: Gothic Revival church of 1875-83, rock-faced coursed limestone, the tower of
 * 1892-93 designed for a spire that was never built — Historic England list entry 1369345; G: the tower's place at the
 * west end, its height ~29 m, the belfry and pinnacles).
 */
export const CHURCH = { id: 'w196607245', tower: [1967.6, 1067.0], w: 6.2, H: 26.5, h: Math.atan2(1080 - 1077.3, 1996.1 - 1971.1) };
export function churchTower(B, q) {
  const [x, z] = CHURCH.tower, w = CHURCH.w, H = CHURCH.H, ux = Math.cos(CHURCH.h), uz = Math.sin(CHURCH.h);
  B.push(frame(x, 0, z, ux, uz));
  B.box('rubble', 0, H / 2, 0, w, H, w, 0, { top: false });
  // diagonal buttresses at the corners, set-offs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.box('rubbleDk', sx * (w / 2 + 0.25), H * 0.35, sz * (w / 2 + 0.25), 0.9, H * 0.7, 0.9, Math.PI / 4); if (q < 2) B.box('dress', sx * (w / 2 + 0.25), H * 0.7 + 0.15, sz * (w / 2 + 0.25), 0.7, 0.3, 0.7, Math.PI / 4); }
  // string courses, belfry openings (two per face), a west window, battlements and four pinnacles
  for (const y of [8.6, 17.0, H - 0.4]) B.box('dress', 0, y, 0, w + 0.24, 0.3, w + 0.24, 0, { bottom: true });
  if (q < 2) for (let k = 0; k < 4; k++) {
    const t = k * Math.PI / 2; B.push(frame(Math.sin(t) * (w / 2 + 0.01), 0, Math.cos(t) * (w / 2 + 0.01), Math.cos(t), -Math.sin(t)));
    for (const sx of [-1, 1]) B.archUnit('louvre', sx * 1.25, 1.3, H - 6.6, H - 2.8, 0, [DARK[k], 1], q ? 5 : 8);
    if (k === 2) B.archUnit('arch', 0, 2.0, 2.0, 6.2, 0, [140, 1], 8);
    if (q === 0) B.unit('perp', rect(-0.9, 12.0, 0.9, 14.6), 0, [0, 0]);
    B.pop();
  }
  for (let k = 0; k < 4; k++) {
    const t = k * Math.PI / 2, ax = Math.sin(t), az = Math.cos(t), bx = Math.cos(t), bz = -Math.sin(t);
    if (q < 2) { const n = 4; for (let i = 0; i < n; i++) { const o = -w / 2 + (i + 0.5) * w / n; B.box('dress', ax * (w / 2 - 0.2) + bx * o, H + 0.45, az * (w / 2 - 0.2) + bz * o, 0.7, 0.9, 0.4, t); } }
    else B.box('dress', ax * (w / 2 - 0.2), H + 0.35, az * (w / 2 - 0.2), w, 0.7, 0.4, t);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.box('dress', sx * (w / 2 - 0.3), H + 1.0, sz * (w / 2 - 0.3), 0.6, 2.0, 0.6, 0, { top: false }); B.cyl('dress', sx * (w / 2 - 0.3), H + 2.0, sz * (w / 2 - 0.3), 0.02, 2.2, 4, false, 0.4); }
  B.flat('lead', [[-w / 2, -w / 2], [w / 2, -w / 2], [w / 2, w / 2], [-w / 2, w / 2]], H - 0.2);
  B.cyl('iron', 0, H - 0.2, 0, 0.04, 3.2, 4, false);
  B.pop();
}

// ------------------------------------------------------------------------------------------------ the shop parade
/**
 * Dress one shop front (face f of a mapped shop): painted roller shutters for after closing (into Bn, drawn at night),
 * and by day (into Bd) produce crates outside grocers, an A-board outside cafés, a striped awning on some.
 * kind: the business kind; s: a 0..1 seed.
 */
export function shopDress(Bn, Bd, f, kind, s, q, map) {
  const U = units(f.L, 4.8);
  Bn.push(faceFrame(f)); Bd.push(faceFrame(f));
  U.forEach(([x0, x1], k) => {
    const h = (s * 7.31 + k * 0.618) % 1;
    // shutters: about two in three of the units close at night (takeaways and pubs stay open)
    if (!/fast_food|pub|bar|nightclub|restaurant/.test(kind) && h < 0.68) {
      Bn.box('iron', (x0 + x1) / 2, 2.78, 0.2, x1 - x0 + 0.1, 0.26, 0.3, 0, { bottom: true });
      signAt(Bn, h < 0.34 ? 'shutterA' : 'shutterB', x0, x1, 0.05, 2.64, 0.11);
    }
    if (q === 2) return;
    const pave = (o) => { const wx = f.mx + f.ux * o + f.nx * 0.9, wz = f.mz + f.uz * o + f.nz * 0.9; return offCarriage(map, wx, wz, 0.9); };
    const xm = (x0 + x1) / 2;
    if (/convenience|greengrocer|supermarket|deli/.test(kind) && k === 0 && pave(xm)) {
      // the grocer's stall: a stepped trestle of crates heaped with fruit and veg under the window
      Bd.box('oak', xm, 0.42, 0.55, x1 - x0 - 0.4, 0.06, 0.9, 0); for (const sx of [-1, 1]) Bd.box('oak', xm + sx * ((x1 - x0) / 2 - 0.35), 0.21, 0.55, 0.06, 0.42, 0.8, 0, { top: false });
      const prod = ['steamerRed', 'gold', 'grass', 'render3', 'red', 'render1', 'foliage'];
      const n = Math.max(2, Math.floor((x1 - x0 - 0.4) / 0.55));
      for (let i = 0; i < n; i++) for (const [zz, yy] of [[0.78, 0.45], [0.38, 0.62]]) { const x = xm - (x1 - x0 - 0.4) / 2 + (i + 0.5) * (x1 - x0 - 0.4) / n; Bd.box('oak', x, yy + 0.06, zz, 0.5, 0.12, 0.38, 0); Bd.box(prod[(i * 3 + Math.round(zz * 10) + k) % prod.length], x, yy + 0.15, zz, 0.44, 0.08, 0.32, 0, { bottom: false }); }
    } else if (/cafe|restaurant|fast_food|bakery|pub|bar/.test(kind) && k === U.length - 1 && pave(x1 - 0.6)) {
      // an A-board on the pavement edge (painted menu)
      const x = x1 - 0.6, zz = 1.7;
      Bd.push(frame(x, 0, zz, 1, 0)); Bd.poly('menu', [[-0.3, 0.02, 0.18], [0.3, 0.02, 0.18], [0.3, 0.95, 0.02], [-0.3, 0.95, 0.02]], [0, 0.2, 1], [[DARK[1] + 0.05, 0.05], [DARK[1] + 0.95, 0.05], [DARK[1] + 0.95, 0.95], [DARK[1] + 0.05, 0.95]]); Bd.poly('oak', [[0.3, 0.02, -0.18], [-0.3, 0.02, -0.18], [-0.3, 0.95, -0.02], [0.3, 0.95, -0.02]], [0, 0.2, -1]); Bd.pop();
    }
    if (h > 0.55 && h < 0.8 && q === 0 && (x1 - x0) > 2.4) {
      // a striped canvas awning (G: the world adds its own on some units; these are extra, in Cowley Road colours)
      const key = ['awnRed', 'awnGreen', 'awnBlue', 'awnYellow', 'awnPlum'][Math.floor(h * 97) % 5], y = 3.0, d = 1.3;
      Bd.poly(key, [[x0, y, 0.22], [x1, y, 0.22], [x1, y - 0.55, d], [x0, y - 0.55, d]], [0, 1, 0.5], [[0, 0], [x1 - x0, 0], [x1 - x0, 1.4], [0, 1.4]]);
      Bd.poly(key, [[x0, y - 0.55, d], [x1, y - 0.55, d], [x1, y - 0.85, d], [x0, y - 0.85, d]], [0, 0, 1], [[0, 0], [x1 - x0, 0], [x1 - x0, 0.3], [0, 0.3]]);
      Bd.poly('dark', [[x1, y, 0.22], [x0, y, 0.22], [x0, y - 0.55, d], [x1, y - 0.55, d]], [0, -1, -0.5]);
    }
  });
  Bn.pop(); Bd.pop();
}

/** a row of n Sheffield stands with bikes, on the pavement in front of face f at offset `along`, if the spot is clear */
export function bikeRow(B, f, along, n, map, q, seed = 0) {
  const out = 1.5, pts = [];
  for (let k = 0; k < n; k++) {
    const o = along + (k - (n - 1) / 2) * 1.0, x = f.mx + f.ux * o + f.nx * out, z = f.mz + f.uz * o + f.nz * out;
    if (!offCarriage(map, x, z, 1.0) || !offBuildings(map, x, z, 0.6)) continue;
    pts.push([x, z]);
  }
  const h = Math.atan2(f.nx, f.nz);
  pts.forEach(([x, z], k) => { stand(B, x, z, h); if ((k + seed) % 3 !== 2) bike(B, x + f.ux * 0.3, z + f.uz * 0.3, h + ((k + seed) % 2 ? Math.PI : 0), ['navy', 'red', 'boatGreen', 'bike', 'render7'][(k + seed) % 5], q); });
  return pts.length;
}
export { festoon, bulb };
