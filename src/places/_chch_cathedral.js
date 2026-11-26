// Christ Church Cathedral — a simple interior (plain layout for a later fine-detail pass): the late-Norman nave
// (c. 1160-1200; truncated by Wolsey) with round piers and the giant arches, aisles, a timber nave roof, and the choir
// under its pendant lierne vault (late 15th c.), the east end with the rose window, pews.
// Frame: x 0 (west, the door from Tom Quad) .. LEN (east), z -HW..HW (aisle walls), floor y = 0.
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts, sharedMats, addPoint, buildBatch } from './_worcint_kit.js';
import { lathe, pointedPts, aliasParts } from './_chch_kit.js';
import { buildFine, ribStrip, col as col2 } from './_se_fine.js';
import { stonePassage, stoneMats } from './_wc_stone.js';
import { stainedGlass, archLining, reveal, headDrop } from './_walkin_city.js';

const STALL = { x0: 29.6, x1: 36.6 };
export const CATH = { LEN: 46, HW: 8, nave: 4, bay: 4.4, choirX: 28, arcH: 12.5, roof: 15 };

// Walk-in (core/interiors.js "seamless"; plan in christ_church.js): the cathedral in place in its mapped building —
// one metre shorter and the nave 0.8 m lower than CATH, to stay inside the mapped aisles and under the mapped nave
// roof — reached as in life from Tom Quad through the passage in the quad's east range (PASS: it comes out in the west
// bay of the south aisle; the old west door on the axis stays shut). Aisle windows with open air beyond are real
// openings glazed with stained glass.
// The door is in a bay of the quad's east range (pass.doorZ); the passage runs straight in from it to a small
// vestibule (pass.vest long) that opens north into the west bay of the south aisle (pass.z). The aisle windows are
// two-light pointed windows (win: the opening is the bounding rectangle, sill to point).
export const CATHS = { LEN: 45, roof: 14.2, arcH: 11.9, pass: { z: 6.85, doorZ: 8.15, len: 15.16, vest: 4.4, throat: 0.5, hw: 1.1, h: 3.0, vh: 3.3 }, door: { w: 1.7, h: 2.85, head: 'pointed', rise: 1.05 },
  win: { w: 1.8, y0: 2.6, y1: 6.3, head: 'pointed', rise: 1.35 } };
/** the outline of an aisle window (walk-in), centre x: [[x, y]…] anticlockwise from the lower left, the head as headDrop draws it */
function winPts(x, W, n = 10) { const hw = W.w / 2, d = headDrop(W.head, W.w, W.rise), p = [[x - hw, W.y0], [x + hw, W.y0]]; for (let i = 0; i <= n; i++) { const s = hw - (W.w * i) / n; p.push([x + s, W.y1 - d(s)]); } return p; }
export function buildCathedral(ctx, game, o = {}) {
  const SL = !!o.sl, PS = CATHS.pass;
  const S = sharedMats(game), B = new Batch(), sc = ctx.scene, col = ctx.collider, C = SL ? { ...CATH, LEN: CATHS.LEN, roof: CATHS.roof, arcH: CATHS.arcH } : CATH, L = C.LEN, hw = C.HW, nv = C.nave;
  const real = (side, x) => !!(SL && o.open && o.open.some((w) => w.side === side && Math.abs(w.x - x) < 0.1));
  const st = game.world.mats.stone.map;
  const mats = { ...S, wall: S.std({ color: 0xe9dfca, roughness: 0.9, map: st }), vault: S.std({ color: 0xf2eadb, roughness: 0.9 }), roofOak: S.std({ color: 0x5a3a24, roughness: 0.7 }),
    sky: new THREE.MeshBasicMaterial({ color: 0xc8d4ec }), rose: new THREE.MeshBasicMaterial({ color: 0x9a6a8a }), altar: S.std({ color: 0x6a1a22, roughness: 0.8 }) };
  // outer walls (aisles) with round-headed windows; west + east ends
  const nb = Math.round(L / C.bay), aw = [], glass = []; for (let i = 0; i < nb; i++) aw.push(SL ? winPts((i + 0.5) * C.bay, CATHS.win) : archPts((i + 0.5) * C.bay, 1.2, 3.2, 5.6, 8));
  // (walk-in: every aisle window is leaded coloured glass — stainedGlass below; the ones with open air beyond are real openings)
  const gl = (x, z, out, isReal) => glass.push({ at: [x, z], out, w: CATHS.win.w, y0: CATHS.win.y0, y1: CATHS.win.y1, head: 'pointed', rise: CATHS.win.rise, lights: 1, depth: 0.42, real: isReal });
  B.push(frame(0, 0, -hw, 1, 0)); B.face('wall', rectPts(0, 0, L, 8), aw); aw.forEach((h, i) => { const r = real(-1, (i + 0.5) * C.bay); if (!r) B.reveal('wall', h, 0, -0.5); if (SL) gl((i + 0.5) * C.bay, -hw, Math.PI, r); else B.face('sky', h, [], -0.5); }); B.pop();
  B.push(frame(L, 0, hw, -1, 0)); B.face('wall', rectPts(0, 0, L, 8), aw); aw.forEach((h, i) => { const x = L - (i + 0.5) * C.bay, r = real(1, x); if (!r) B.reveal('wall', h, 0, -0.5); if (SL) gl(x, hw, 0, r); else B.face('sky', h, [], -0.5); }); B.pop();
  const door = archPts(hw, 2.0, 0, 2.4, 8);
  B.push(frame(0, 0, hw, 0, -1)); B.face('wall', [[0, 0], [hw - 1, 0], ...door.slice(2).reverse(), [hw + 1, 0], [2 * hw, 0], [2 * hw, 8], [hw + nv, C.arcH], [hw + nv, C.roof], [hw - nv, C.roof], [hw - nv, C.arcH], [0, 8]], SL ? [rectPts(hw - PS.z - PS.hw, 0.001, hw - PS.z + PS.hw, PS.h)] : []); B.face('darkOak', door, [], -0.3); B.pop();
  const rose = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; rose.push([hw + Math.cos(a) * 2.2, 9.6 + Math.sin(a) * 2.2]); }
  B.push(frame(L, 0, -hw, 0, 1)); B.face('wall', [[0, 0], [2 * hw, 0], [2 * hw, 8], [hw + nv, C.arcH], [hw + nv, C.roof], [hw - nv, C.roof], [hw - nv, C.arcH], [0, 8]], [rose, archPts(hw - 1.6, 1.2, 3.0, 6.0, 8), archPts(hw + 1.6, 1.2, 3.0, 6.0, 8)]);
  B.face('rose', rose, [], -0.3); B.face('sky', archPts(hw - 1.6, 1.2, 3.0, 6.0, 8), [], -0.3); B.face('sky', archPts(hw + 1.6, 1.2, 3.0, 6.0, 8), [], -0.3); B.pop();
  // aisle roofs (flat, at 8 m) and the arcades: round piers carrying round arches, clerestory above
  B.flat('vault', rectPts(0, -hw, L, -nv), 8, [], true); B.flat('vault', rectPts(0, nv, L, hw), 8, [], true);
  for (const s of [-1, 1]) {
    const holes = []; for (let i = 0; i < nb; i++) holes.push(archPts((i + 0.5) * C.bay, C.bay - 1.3, 0, 6.2, 10));
    const cl = []; for (let i = 0; i < nb; i++) cl.push(archPts((i + 0.5) * C.bay, 0.9, 9.6, 11.4, 6));
    const z = s * nv;
    // both faces of the arcade wall (into the nave, into the aisle)
    const outline = [[0, 0], ...holes.flatMap((h) => [[h[0][0], 0], ...h.slice(2).reverse(), [h[1][0], 0]]), [L, 0], [L, C.arcH], [0, C.arcH]];
    B.push(s < 0 ? frame(0, 0, z, 1, 0) : frame(L, 0, z, -1, 0)); B.face('wall', s < 0 ? outline : outline.map(([a, b]) => [L - a, b]).reverse(), []); B.pop();
    B.push(s < 0 ? frame(L, 0, z - 0.6, -1, 0) : frame(0, 0, z + 0.6, 1, 0)); B.face('wall', s < 0 ? outline.map(([a, b]) => [L - a, b]).reverse() : outline, []); B.pop();
    // clerestory wall above the aisle roof line
    // (the wall between the arcade's head and the nave roof: it was open — the sky showed above the arcades)
    B.push(s < 0 ? frame(0, 0, z, 1, 0) : frame(L, 0, z, -1, 0)); B.face('wall', s < 0 ? rectPts(0, C.arcH, C.choirX, C.roof) : rectPts(L - C.choirX, C.arcH, L, C.roof), []); void cl; B.pop();
    for (let i = 0; i <= nb; i++) { const x = i * C.bay; B.cyl('wall', x, 0, z - s * 0.3, 0.58, 6.2, 14, false); B.box('wall', x, 6.35, z - s * 0.3, 1.4, 0.3, 1.4); col.addCircle(x, z - s * 0.3, 0.62); }      // (every pier, the half piers against the west and east walls too: those two used to be walked into)
  }
  // nave: timber roof; choir: the pendant lierne vault (a pointed barrel with hanging pendants), plain
  B.flat('roofOak', rectPts(0, -nv, C.choirX, nv), C.roof - 0.4, [], true);
  for (let x = 0; x <= C.choirX; x += C.bay) B.beam('roofOak', [x, C.arcH, -nv], [x, C.arcH, nv], 0.3, 0.4);
  const prof = []; for (let k = 0; k <= 8; k++) { const t = k / 8, a = t * Math.PI; prof.push([-Math.cos(a) * nv, C.arcH + Math.sin(a) * (C.roof - C.arcH - 0.5)]); }
  for (let k = 0; k < 8; k++) { const [z0, y0] = prof[k], [z1, y1] = prof[k + 1]; B.poly('vault', [[C.choirX, y0, z0], [L, y0, z0], [L, y1, z1], [C.choirX, y1, z1]], [0, -1, -(z0 + z1) / 2]);
    B.poly('wall', [[C.choirX, y0, z0], [C.choirX, y1, z1], [C.choirX, C.roof, z1], [C.choirX, C.roof, z0]], [-1, 0, 0]); }   // (the wall over the choir arch, up to the nave roof: it was open to the sky)
  for (let x = C.choirX + C.bay / 2; x < L; x += C.bay) for (const zz of [-1.6, 1.6]) lathe(B, 'vault', x, zz, [[0.5, C.roof - 1.2], [0.4, C.roof - 2.2], [0.15, C.roof - 2.8], [0, C.roof - 3.0]], 8, 0);
  // floor, choir step, altar, pews
  B.flat('stoneFloor', rectPts(0, -hw, L, hw), 0);
  B.boxXZ('stoneFloor', C.choirX, L, 0, 0.3, -nv, nv);
  B.boxXZ('altar', L - 2.6, L - 1.4, 0.3, 1.3, -1.5, 1.5);
  for (let x = 4; x < C.choirX - 2; x += 1.3) for (const s of [-1, 1]) { B.boxXZ('darkOak', x, x + 0.45, 0.4, 0.46, s * 0.7, s * 3.5); B.boxXZ('darkOak', x + 0.4, x + 0.48, 0.46, 1.0, s * 0.7, s * 3.5); }
  for (const s of [-1, 1]) col.addBox((4 + C.choirX - 2) / 2, s * 2.1, C.choirX - 6, 2.8);
  col.addSegment(0, -hw, L, -hw); col.addSegment(0, hw, L, hw); col.addSegment(L, -hw, L, hw);
  // (walk-in: the passage from the door, the vestibule, the throat into the aisle; x < 0)
  const pz0 = PS.doorZ - PS.hw, pz1 = PS.doorZ + PS.hw, vz0 = PS.z - PS.hw, vz1 = PS.z + PS.hw, vx = -PS.vest, tx = -PS.throat;
  if (SL) { col.addSegment(0, -hw, 0, vz0); col.addSegment(0, vz1, 0, hw);
    col.addSegment(-PS.len, pz0, -PS.len, pz1); col.addSegment(-PS.len, pz0, vx, pz0); col.addSegment(vx, pz0, vx, vz0); col.addSegment(vx, vz0, 0, vz0);
    col.addSegment(-PS.len, pz1, tx, pz1); col.addSegment(tx, pz1, tx, vz1); col.addSegment(tx, vz1, 0, vz1); }
  else col.addSegment(0, -hw, 0, hw);
  col.addBox(L - 2, 0, 1.2, 3);
  // ---- fine-detail pass: the choir's pendant lierne vault (transverse, diagonal and ridge ribs; from each lantern
  //      pendant a little fan of ribs spreads into the vault), scalloped capitals, candles; everything in ONE mesh
  {
    const RIB = col2('plain', 0.74, 0.63, 0.45);   // the ribs a shade darker than the plastered-pale vault, so the net reads
    const yv = (z) => C.arcH + Math.sin(Math.acos(Math.max(-1, Math.min(1, -z / nv)))) * (C.roof - C.arcH - 0.5), down = () => [0, -1, 0];
    const arc = (x0, x1, n = 10) => { const pts = []; for (let k = 0; k <= n; k++) { const t = k / n, z = -nv + 2 * nv * t; pts.push([x0 + (x1 - x0) * t, yv(z) - 0.03, z]); } return pts; };
    for (let x = C.choirX; x < L - 0.1; x += C.bay / 2) { ribStrip(B, RIB, arc(x, x), down, 0.15); }
    for (let x = C.choirX; x < L - 0.1; x += C.bay) { const x1 = Math.min(L, x + C.bay); ribStrip(B, RIB, arc(x, x1), down, 0.12); ribStrip(B, RIB, arc(x1, x), down, 0.12); }
    ribStrip(B, RIB, [[C.choirX, C.roof - 0.53, 0], [L, C.roof - 0.53, 0]], down, 0.12);
    for (const zz of [-2.2, 2.2]) ribStrip(B, RIB, [[C.choirX, yv(zz) - 0.03, zz], [L, yv(zz) - 0.03, zz]], down, 0.08);
    for (let x = C.choirX + C.bay / 2; x < L; x += C.bay) for (const zz of [-1.9, 1.9]) {
      const y0 = yv(zz);
      lathe(B, 'stoneFine', x, zz, [[0, y0 - 2.5], [0.17, y0 - 2.3], [0.26, y0 - 1.95], [0.13, y0 - 1.7], [0.2, y0 - 1.2], [0.6, y0 - 0.5], [1.25, y0 - 0.12]], 8, 0);
      lathe(B, 'gilt', x, zz, [[0, y0 - 2.62], [0.08, y0 - 2.52], [0, y0 - 2.42]], 6, 0);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a); ribStrip(B, RIB, [[x + sa * 0.2, y0 - 1.2, zz + ca * 0.2], [x + sa * 0.6, y0 - 0.5, zz + ca * 0.6], [x + sa * 1.25, y0 - 0.12, zz + ca * 1.25]], () => [sa * 0.6, -0.8, ca * 0.6], 0.06); }
    }
    for (const s2 of [-1, 1]) for (let i = 0; i <= nb; i++) lathe(B, 'mouldPale', i * C.bay, s2 * nv - s2 * 0.3, [[0.58, 5.75], [0.66, 5.85], [0.6, 5.95], [0.82, 6.2]], 14, 0);   // capitals
    for (const zz of [-1.1, 1.1]) { B.box('brass', L - 2.0, 1.55, zz, 0.06, 0.5, 0.06); B.box('lampOn', L - 2.0, 1.86, zz, 0.035, 0.12, 0.035); }
    B.box('gilt', L - 2.0, 1.75, 0, 0.06, 0.9, 0.06); B.box('gilt', L - 2.0, 1.95, 0, 0.06, 0.06, 0.5);
    // the choir stalls: two rows a side facing across (dark oak, book rests), where the choir sings at Evensong
    for (const s2 of [-1, 1]) { for (const [z0, y0] of [[1.9, 0.3], [2.6, 0.5]]) { B.boxXZ('darkWood', STALL.x0, STALL.x1, y0, y0 + 0.45, s2 * (z0 + 0.1), s2 * (z0 + 0.55)); B.boxXZ('darkWood', STALL.x0, STALL.x1, y0 + 0.45, y0 + 1.15, s2 * (z0 + 0.48), s2 * (z0 + 0.55)); B.boxXZ('oakDark', STALL.x0, STALL.x1, y0 + 0.5, y0 + 0.95, s2 * (z0 - 0.12), s2 * (z0 - 0.06)); B.boxXZ('oakDark', STALL.x0, STALL.x1, y0 + 0.95, y0 + 0.99, s2 * (z0 - 0.2), s2 * (z0 - 0.02)); }
      for (const x of [STALL.x0, STALL.x1]) { B.boxXZ('darkWood', x - 0.05, x + 0.05, 0.3, 1.75, s2 * 1.7, s2 * 3.2); lathe(B, 'gilt', x, s2 * 1.74, [[0.07, 1.75], [0.1, 1.83], [0, 1.95]], 6, 0); }
      col.addBox((STALL.x0 + STALL.x1) / 2, s2 * 2.45, STALL.x1 - STALL.x0, 1.5); }
    if (SL) {
      // the way in, dressed (was bare stone): a plinth course and transverse stone arches on wall shafts along the passage,
      // lanterns, a coir mat at the door; in the vestibule a notice board, an oak bench and an offertory box
      const pz0 = PS.doorZ - PS.hw, pz1 = PS.doorZ + PS.hw, vz0 = PS.z - PS.hw, vz1 = PS.z + PS.hw, vx = -PS.vest, tx = -PS.throat;
      // the three little rooms in the same ashlar as the nave (walls with their doorways left open, flagged floor, plastered ceiling)
      const cell = ({ x0, x1, z0, z1, h, holes }) => {
        B.flat('stoneFloor', rectPts(x0, z0, x1, z1), 0.003); B.flat('vault', rectPts(x0, z0, x1, z1), h, [], true);
        const wall = (k, M, len, at) => { B.push(M); let s = 0; for (const q of holes.filter((o) => o.wall === k).map((o) => ({ a: at(o.c) - o.w / 2, b: at(o.c) + o.w / 2, h: o.h })).sort((p, q) => p.a - q.a)) { if (q.a - s > 0.01) B.face('wall', rectPts(s, 0, q.a, h)); if (h - q.h > 0.01) B.face('wall', rectPts(q.a, q.h, q.b, h)); s = q.b; } if (len - s > 0.01) B.face('wall', rectPts(s, 0, len, h)); B.pop(); };
        wall('n', frame(x0, 0, z0, 1, 0), x1 - x0, (c) => c - x0); wall('s', frame(x1, 0, z1, -1, 0), x1 - x0, (c) => x1 - c);
        wall('w', frame(x0, 0, z1, 0, -1), z1 - z0, (c) => z1 - c); wall('e', frame(x1, 0, z0, 0, 1), z1 - z0, (c) => c - z0);
      };
      cell({ x0: -PS.len, x1: vx, z0: pz0, z1: pz1, h: PS.h, holes: [{ wall: 'w', c: PS.doorZ, w: CATHS.door.w, h: CATHS.door.h }, { wall: 'e', c: PS.doorZ, w: PS.hw * 2, h: PS.h }] });
      cell({ x0: vx, x1: tx, z0: vz0, z1: pz1, h: PS.vh, holes: [{ wall: 'w', c: PS.doorZ, w: PS.hw * 2, h: PS.h }, { wall: 'e', c: PS.z, w: PS.hw * 2, h: PS.h }] });
      cell({ x0: tx, x1: -0.02, z0: vz0, z1: vz1, h: PS.h, holes: [{ wall: 'w', c: PS.z, w: PS.hw * 2, h: PS.h }, { wall: 'e', c: PS.z, w: PS.hw * 2, h: PS.h }] });
      for (const z of [pz0, pz1]) B.boxXZ('mouldPale', -PS.len + 0.02, z === pz0 ? -PS.vest : -PS.throat, 0, 0.32, z - 0.05, z + 0.05);
      for (let x = -PS.len + 1.9; x < -PS.vest - 0.5; x += 3.0) {
        for (const z of [pz0, pz1]) { const sg = z === pz0 ? 1 : -1; B.boxXZ('mouldPale', x - 0.16, x + 0.16, 0, 2.2, z + sg * 0.0, z + sg * 0.13); B.boxXZ('mould', x - 0.2, x + 0.2, 2.2, 2.34, z, z + sg * 0.17); }
        let pv = null; for (let k = 0; k <= 8; k++) { const t = k / 8, zz = pz0 + 0.1 + (pz1 - pz0 - 0.2) * t, pt = [x, 2.34 + (PS.h - 2.46) * Math.sin(t * Math.PI), zz]; if (pv) B.beam('mouldPale', pv, pt, 0.3, 0.16); pv = pt; }
      }
      for (let x = -PS.len + 3.4; x < -PS.vest - 0.5; x += 6.0) { B.box('iron', x, 2.3, pz0 + 0.12, 0.04, 0.04, 0.24); B.box('lampOn', x, 2.08, pz0 + 0.22, 0.16, 0.26, 0.16); B.box('iron', x, 2.23, pz0 + 0.22, 0.2, 0.03, 0.2); }
      B.boxXZ('carve', -PS.len + 0.3, -PS.len + 1.5, 0.003, 0.024, PS.doorZ - 0.7, PS.doorZ + 0.7);
      // vestibule: notice board on the north wall, bench under it, offertory box by the way into the aisle
      B.boxXZ('oakDark', -3.9, -1.9, 1.05, 2.15, vz0 + 0.0, vz0 + 0.05); B.boxXZ('linenDark', -3.82, -1.98, 1.13, 2.07, vz0 + 0.05, vz0 + 0.06);
      for (let k = 0; k < 5; k++) B.boxXZ('white', -3.7 + k * 0.36, -3.7 + k * 0.36 + 0.26, 1.3 + (k % 2) * 0.3, 1.66 + (k % 2) * 0.3, vz0 + 0.06, vz0 + 0.066);
      B.boxXZ('darkWood', -3.8, -2.0, 0.42, 0.47, vz0 + 0.08, vz0 + 0.46); for (const x of [-3.7, -2.1]) B.boxXZ('darkWood', x - 0.04, x + 0.04, 0, 0.42, vz0 + 0.1, vz0 + 0.44);
      B.boxXZ('darkWood', -0.95, -0.6, 0, 0.95, PS.doorZ + 0.55, PS.doorZ + 0.9); B.boxXZ('brass', -0.86, -0.69, 0.95, 0.96, PS.doorZ + 0.68, PS.doorZ + 0.77);
      B.box('iron', -PS.vest / 2 - 0.2, PS.vh - 0.35, PS.z + 0.6, 0.03, 0.7, 0.03); B.box('lampOn', -PS.vest / 2 - 0.2, PS.vh - 0.85, PS.z + 0.6, 0.24, 0.34, 0.24);
    }
    aliasParts(B, { wall: 'stoneIn', vault: 'stoneFine', roofOak: 'oakRoof', sky: col2('glass', 0.72, 0.84, 1.0, 0.9, 2), rose: col2('herald', 1.0, 0.85, 0.95, 0.95, 2), altar: 'red', stoneFloor: 'flags', darkOak: 'darkWood' });
    buildFine(B, game.world, sc, 'chch:cathedral:fine', { interior: true, cast: false }).receiveShadow = false;
  }
  void buildBatch; void mats;
  void pointedPts;
  const ret = {};
  if (SL && o.plan) {
    const P = o.plan.seamless;
    sc.add(stonePassage(P.portals[0]));
    { const a = archLining({ sl: P }, [{ p: 0, head: CATHS.door.head, rise: CATHS.door.rise }], { color: 0xbfb393 }); if (a) sc.add(a); }
    if (P.openings.length) sc.add(reveal(P.openings.map((w) => ({ ...w, y: w.y0, h: w.y1 - w.y0 })), { floor: true, mat: stoneMats().reveal }));
    // (a real window's glass stands near the outer face of the wall, behind the stone mullion drawn outside)
    const opOf = (w) => P.openings.find((q) => Math.abs(q.at[0] - w.at[0]) < 0.3 && Math.abs(q.at[1] - w.at[1]) < 0.3);
    // (glazed twice with the same lights: the pane seen from inside at the inner face of the wall — every window — and the
    //  pane seen from outside 25 cm behind the outer face of the real ones)
    const SG = stainedGlass(glass.map((w, i) => ({ ...w, seed: 11 + i, ...(w.real && opOf(w) ? { head: 'flat' } : {}) })), { palette: 'rich', pane: 0.3, inset: 1, floor: 0, floorReach: 2.2 });
    const SGo = stainedGlass(glass.map((w, i) => ({ ...w, seed: 11 + i, q: w.real ? opOf(w) : null })).filter((w) => w.q).map((w) => ({ ...w, head: 'flat', depth: w.q.depth - 0.25 })), { palette: 'rich', pane: 0.3, inset: 1 });
    for (const [G, drop] of [[SG, 'wc:sg-out'], [SGo, 'wc:sg-in']]) { for (const m of [...G.group.children]) { if (m.name === drop) G.group.remove(m); else m.name = 'wc:win-' + m.name.slice(3); } sc.add(G.group); }
    ret.setLight = (d, l) => { SG.setLight(d, l); SGo.setLight(d, l); };
    addPoint(sc, -PS.vest / 2 - 0.2, 2.5, PS.z + 0.6, 0xffe2b8, 3, 9, 1.5);          // the porch lamp (one light for passage and vestibule)
  }
  for (const x of [10, 26, 40]) addPoint(sc, x, 7, 0, 0xffe2b8, 4, 18, 1.4);
  ctx.setGround((x, z) => (x > C.choirX && Math.abs(z) < nv ? 0.3 : 0));
  if (SL) return { ...ret, spawn: [-PS.len + 1.6, PS.doorZ], heading: Math.PI / 2 };
  return { spawn: [1.6, 0], heading: Math.PI / 2 };
}
