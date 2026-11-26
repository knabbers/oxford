// Oxford station's trains (owned by places/oxford_station.js): a pure timetable on the shared clock and the train model.
// GUESSED (stylised, see docs/research/city_centre_west.md): two four-car diesel units in a generic livery (no operator's
// colours or marks), each running in from the north through a covered way, standing at its platform and going back out
// the way it came (terminating services reverse at Oxford); 120 s cycles, the two platforms half a cycle apart.
import * as THREE from 'three';
import { RB, geoOf, TAU } from './_cw_kit.js';

export const CAR = 23.0, CARS = 4, LEN = CAR * CARS, W = 2.8, H = 3.8;
export const CYCLE = 120000;           // ms of the shared clock
export const T_IN = 28000, T_DWELL = 32000, T_OUT = 34000;
// along-track positions (s, metres, + = south): the covered way's north end, where a car is shown, the stop
export const TUNNEL = [-152, -120], SHOW_S = -152;
export const TRAINS = [
  { id: 'p2', platform: 2, t: -8.3, stop: 98, offset: 0, dest: ['London Paddington', 'Reading', 'Didcot Parkway', 'Hereford'] },
  { id: 'p1', platform: 1, t: 6.3, stop: 100, offset: 60000, dest: ['Banbury', 'Birmingham New Street', 'Bicester Town', 'Worcester Shrub Hill'] },
];
const S0 = -170 - 0;                  // where the front is when the train starts in (inside the covered way, hidden)

/**
 * pure: the state of train k at shared time ms -> {phase: 'in'|'dwell'|'out'|'away', front (s of the front end, the
 * southern end), v (m/s, + = south), u (0..1 within the phase), n (the service number, for the destination)}
 */
export function trainAt(k, ms) {
  const T = TRAINS[k], local = ms - T.offset, n = Math.floor(local / CYCLE), t = ((local % CYCLE) + CYCLE) % CYCLE;
  const D = T.stop - S0;
  if (t < T_IN) { const u = t / T_IN, f = T.stop - D * (1 - u) * (1 - u); return { phase: 'in', front: f, v: (2 * D / (T_IN / 1000)) * (1 - u), u, n }; }
  if (t < T_IN + T_DWELL) return { phase: 'dwell', front: T.stop, v: 0, u: (t - T_IN) / T_DWELL, n };
  if (t < T_IN + T_DWELL + T_OUT) { const u = (t - T_IN - T_DWELL) / T_OUT, D2 = T.stop - S0; return { phase: 'out', front: T.stop - D2 * u * u, v: -(2 * D2 / (T_OUT / 1000)) * u, u, n }; }
  return { phase: 'away', front: S0, v: 0, u: 0, n };
}
/** how many cars (from the front) are shown: those whose rear end is south of the covered way's north end */
export function carsShown(front) { let k = 0; for (let c = 0; c < CARS; c++) if (front - (c + 1) * CAR > SHOW_S) k++; return k; }
/** "14:12" for a game hour */
export const hhmm = (h) => { const m = Math.round(((h % 24) + 24) % 24 * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

/**
 * The train model, in the pack's layout, built along +z (front end at z = 0, cars running back to z = -LEN), car c's
 * vertices contiguous and in order (so a draw range of k cars shows the front k). -> {geo, carVerts: [end vertex of car c]}
 */
export function trainGeometry(P) {
  const ends = [], parts = [];
  const ensure = (key, base, o) => { if (!P.cells.has(key)) P.cells.set(key, { ...P.cells.get(base), ...o }); };
  // glass: the sash cell's clear pane (glossy in the aux mask, so it catches the sky and the sun), a lighter streak of it
  ensure('cwTrainGlass', 'cwGlassLit', { tint: [0.32, 0.36, 0.4] }); ensure('cwTrainSheen', 'cwGlassLit', { tint: [0.62, 0.68, 0.74] });
  ensure('cwTrainDoor', 'cwGreen', { tint: [0.5, 0.52, 0.55] }); ensure('cwHead', 'white', { tint: [2.2, 2.2, 2.0] }); ensure('cwTail', 'cwRed', { tint: [0.9, 0.05, 0.03] });
  for (let c = 0; c < CARS; c++) {
    const B = new RB(), z0 = -c * CAR - 0.35, z1 = -(c + 1) * CAR + 0.35, zm = (z0 + z1) / 2, L = z0 - z1, hw = W / 2;
    const cab0 = c === 0, cab1 = c === CARS - 1;
    // body: sides (livery: dark body, a red stripe, a band of windows), roof with a rounded shoulder, underframe
    for (const sx of [-1, 1]) {
      const x = sx * hw, n = [sx, 0, 0];
      const q = (y0, y1, key, za = z0, zb = z1, xx = x) => B.poly(key, [[xx, y0, zb], [xx, y0, za], [xx, y1, za], [xx, y1, zb]], n);
      q(1.05, 1.75, 'cwTrain'); q(1.75, 1.92, 'cwTrainStripe'); q(1.92, 2.0, 'cwTrain'); q(2.0, 2.85, 'cwTrainGlass'); q(2.85, 3.3, 'cwTrainLt');
      // reflections: pale diagonal streaks across the glass band, one per window bay
      for (let k = 0; k < 9; k++) { const za = z1 + (L * (k + 0.25)) / 9, zb = za + L / 9 * 0.22, xs = x + sx * 0.012; B.poly('cwTrainSheen', [[xs, 2.02, za], [xs, 2.02, za + 0.25], [xs, 2.83, zb + 0.25], [xs, 2.83, zb]].map((p) => (sx > 0 ? p : p)), n); }
      // doors: two pairs a side, a pale outline round dark glass
      for (const dz of [0.22, 0.78]) {
        const zc = z1 + L * dz, xo = (d) => x + sx * d;
        B.poly('cwBlack', [[xo(0.015), 1.08, zc - 0.74], [xo(0.015), 1.08, zc + 0.74], [xo(0.015), 3.03, zc + 0.74], [xo(0.015), 3.03, zc - 0.74]], n);
        for (const h of [-1, 1]) {
          const za = zc + (h < 0 ? -0.7 : 0.02), zb = zc + (h < 0 ? -0.02 : 0.7);
          B.poly('cwTrainDoor', [[xo(0.025), 1.1, za], [xo(0.025), 1.1, zb], [xo(0.025), 3.0, zb], [xo(0.025), 3.0, za]], n);
          B.poly('cwTrainGlass', [[xo(0.03), 2.0, za + 0.1], [xo(0.03), 2.0, zb - 0.1], [xo(0.03), 2.8, zb - 0.1], [xo(0.03), 2.8, za + 0.1]], n);
          B.poly('cwTrainSheen', [[xo(0.032), 2.05, za + 0.15], [xo(0.032), 2.05, za + 0.3], [xo(0.032), 2.7, za + 0.45], [xo(0.032), 2.7, za + 0.3]], n);
        }
        B.poly('cwYellow', [[xo(0.035), 1.5, zc - 0.74], [xo(0.035), 1.5, zc - 0.7], [xo(0.035), 2.6, zc - 0.7], [xo(0.035), 2.6, zc - 0.74]], n);   // the grab rail
        B.box('cwTrainLt', zc * 0 + xo(0.04), 1.02, zc, 0.06, 0.06, 1.5);   // the step
      }
      // window pillars over the glass band
      for (let k = 1; k < 9; k++) { const zz = z1 + (L * k) / 9; B.poly('cwTrain', [[x + sx * 0.02, 2.0, zz - 0.09], [x + sx * 0.02, 2.0, zz + 0.09], [x + sx * 0.02, 2.85, zz + 0.09], [x + sx * 0.02, 2.85, zz - 0.09]], n); }
      B.poly('cwTrainLt', [[x, 3.3, z1], [x, 3.3, z0], [x * 0.8, 3.65, z0], [x * 0.8, 3.65, z1]], [sx, 1, 0]);
      B.poly('cwBogie', [[x * 0.92, 0.55, z1 + 0.3], [x * 0.92, 0.55, z0 - 0.3], [x * 0.92, 1.05, z0 - 0.3], [x * 0.92, 1.05, z1 + 0.3]], n);
    }
    B.poly('cwTrainLt', [[-hw * 0.8, 3.65, z1], [hw * 0.8, 3.65, z1], [hw * 0.8, 3.65, z0], [-hw * 0.8, 3.65, z0]], [0, 1, 0]);
    for (let k = 0; k < 3; k++) B.box('cwSteel', 0, 3.72, z1 + L * (0.2 + k * 0.3), 0.9, 0.16, 1.2);     // roof vents / exhaust
    B.box('cwBogie', 0, 0.85, zm, W * 0.7, 0.4, L * 0.35, 0, { top: false });                          // underfloor engine and tanks
    // bogies: two per car, wheels as discs
    for (const bz of [z0 - 3.2, z1 + 3.2]) {
      B.box('cwBogie', 0, 0.5, bz, W * 0.82, 0.45, 2.6, 0, { top: false });
      for (const wz of [bz - 0.95, bz + 0.95]) for (const sx of [-1, 1]) {
        const x = sx * 0.8; for (let k = 0; k < 8; k++) { const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU; B.poly(k % 2 ? 'cwSteel' : 'cwBlack', [[x, 0.42, wz], [x, 0.42 + Math.cos(a0) * 0.42, wz + Math.sin(a0) * 0.42], [x, 0.42 + Math.cos(a1) * 0.42, wz + Math.sin(a1) * 0.42]], [sx, 0, 0]); }
        B.box('cwSteel', sx * 1.0, 0.45, wz, 0.18, 0.22, 0.3);                       // axle box
        B.cyl('cwBogie', sx * 1.0, 0.56, wz, 0.07, 0.25, 5, false);                    // spring
      }
      for (const sx of [-1, 1]) { B.box('cwBogie', sx * 1.0, 0.62, bz, 0.12, 0.16, 2.4); B.box('cwSteel', sx * 0.55, 0.62, bz, 0.25, 0.25, 0.4); }   // side frames, brake cylinders
    }
    // ends: a cab with a yellow warning front, or a gangway end
    for (const [zz, dir, cab] of [[z0, 1, cab0], [z1, -1, cab1]]) {
      const n = [0, 0, dir];
      if (cab) {
        const zf = zz + dir * 0.5;
        B.poly('cwYellow', [[-hw, 1.05, zf], [hw, 1.05, zf], [hw, 2.05, zf], [-hw, 2.05, zf]], n);
        B.poly('cwTrainWin', [[-hw * 0.85, 2.05, zf - dir * 0.25], [hw * 0.85, 2.05, zf - dir * 0.25], [hw * 0.8, 2.9, zz], [-hw * 0.8, 2.9, zz]], [0, 0.4, dir]);
        B.poly('cwYellow', [[-hw * 0.8, 2.9, zz], [hw * 0.8, 2.9, zz], [hw * 0.8, 3.65, zz - dir * 0.2], [-hw * 0.8, 3.65, zz - dir * 0.2]], [0, 0.5, dir]);
        for (const sx of [-1, 1]) {
          B.poly('cwYellow', [[sx * hw, 1.05, zz], [sx * hw, 1.05, zf], [sx * hw, 2.05, zf], [sx * hw, 2.05, zz]], [sx, 0, 0]); B.poly('cwTrainGlass', [[sx * hw, 2.05, zz], [sx * hw, 2.05, zf - dir * 0.25], [sx * hw * 0.8, 2.9, zz], [sx * hw * 0.8, 2.9, zz]], [sx, 0, 0]);
          // headlight pair and a tail lamp in a black surround on each side
          B.box('cwBlack', sx * 0.85, 1.38, zf + dir * 0.02, 0.62, 0.26, 0.04);
          B.box('cwHead', sx * 0.98, 1.38, zf + dir * 0.04, 0.2, 0.16, 0.03); B.box('cwHead', sx * 0.74, 1.38, zf + dir * 0.04, 0.12, 0.12, 0.03); B.box('cwTail', sx * 0.56, 1.38, zf + dir * 0.04, 0.1, 0.1, 0.03);
          B.box('cwBlack', sx * 0.55, 0.62, zf + dir * 0.25, 0.22, 0.22, 0.5);      // buffers / coupler housings
        }
        B.box('cwBlack', 0, 3.25, zz - dir * 0.05, 1.3, 0.22, 0.05); B.box('cwGilt', 0, 3.25, zz - dir * 0.02, 1.1, 0.1, 0.03);   // destination blind (orange dot-matrix)
        B.box('cwBlack', 0, 0.85, zf + dir * 0.15, 0.4, 0.3, 0.3);   // the coupler
        B.box('cwBogie', 0, 0.8, zf, W * 0.9, 0.5, 0.3, 0, { top: false });
      } else {
        B.poly('cwTrain', [[-hw, 1.05, zz], [hw, 1.05, zz], [hw, 3.3, zz], [-hw, 3.3, zz]], n);
        // the gangway: a bellows to the next car (the gap is 0.7 m: each end carries half)
        B.box('cwBlack', 0, 2.1, zz + dir * 0.18, 1.2, 2.1, 0.36, 0, { top: true });
        for (let k = 0; k < 3; k++) B.box('cwBogie', 0, 2.1, zz + dir * (0.06 + k * 0.11), 1.26, 2.16, 0.03);
        for (const sx of [-1, 1]) B.box('cwBlack', sx * 0.9, 0.8, zz + dir * 0.18, 0.2, 0.2, 0.36);
      }
    }
    parts.push(geoOf(B, P));
  }
  // concatenate in car order
  let nV = 0; for (const g of parts) { nV += g.attributes.position.count; ends.push(nV); }
  const geo = new THREE.BufferGeometry();
  for (const name of Object.keys(parts[0].attributes)) {
    const sz = parts[0].attributes[name].itemSize, arr = new Float32Array(nV * sz); let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o * sz); o += g.attributes.position.count; }
    geo.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  geo.computeBoundingSphere();
  return { geo, carVerts: ends };
}
