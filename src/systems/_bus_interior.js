// The inside of a bus (underscore: not auto-loaded; systems/busride.js builds one only for the bus the local player is
// boarding / aboard and throws it away afterwards, so a street full of buses costs nothing more than before).
// ONE draw: every panel, seat, pole, step, door leaf and display is baked from the vehicle kit's own pieces into one
// geometry for MATS.car (the material of the bus body itself: same program, same atlas), an InstancedMesh of 1 whose
// three "instance colour" floats are, as on the body, not a colour: x = how far the doors are open (the leaves slide,
// through the wheel-spin path of the vertex shader with a pivot 100 m away), z = flags (1 = saloon lights on at night,
// 8 = the BUS STOPPING sign lit). The hull is single-sided, so from inside it is not drawn and the windows are simply
// the holes in these panels: the city is seen through them as it is.
// The other passengers and the driver are a second draw: the characters' own baked seated bodies (same faces, hair and
// clothes as everyone in the street, bakeCharacterGeometry) merged into one mesh in the shared character material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MATS, FLAG, GLOW, bakeBuild, busPaxLayout, carAttrs } from './_vehiclemeshes.js';
import { bakeCharacterGeometry, characterMaterial, randomLook } from '../core/characters.js';
import { BUS, DOOR, AXLES, STAIR, decks, seatLayout, paxSeats } from './_busride_logic.js';

const COL = {
  panel: 0xb4b9bf, panelLo: 0x8e949b, ceil: 0xe6e3da, floor: 0x5b6067, pillar: 0x7d838a, moq: 0x2c4391, shell: 0x33373d, rail: 0xf0c000,
  dark: 0x1e2126, step: 0x464a50, bell: 0xc8201c, cab: 0x5d636b, dash: 0x2a2d32, box: 0x70767d, sign: 0x9a9a9a, white: 0xffffff, wheel: 0x17181a,
};
const PILLARS = [-4.7, -3.38, -2.06, -0.74, 0.58, 1.9, 3.22, 4.54];      // the hull's window pillars (buildBus)
export const DOOR_SLIDE = 0.5;                                          // m each leaf slides
const DOOR_PIVOT = 100;

const _geo = new Map();
/** The interior geometry of a body style ('bus' double-decker, 'bus1' single), cached. */
export function interiorGeometry(style) {
  const key = style === 'bus1' ? 'bus1' : 'bus';
  let g = _geo.get(key);
  if (!g) { g = build(key); _geo.set(key, g); }
  return g;
}

function build(style) {
  const D = decks(style), dd = D.dd, W = BUS.wall, yL = D.floor[0], S = seatLayout(style);
  return bakeBuild((b, kit) => {
    const acc = kit.acc, SAL = kit.GLOW.cabin;
    const box = (w, h, d, x, y, z, col, skip = '') => { b.box(w, h, d, x, y, z, col, 'body', 0, 0, 0, skip); return b; };
    const quad = (p, col, hint, tile = null, opt = null) => acc.decal(Object.assign({ color: col, glow: SAL }, opt), p, tile, hint);
    const rod = (a, c, r, col, seg = 7) => b.rod(a, c, r, seg, col, 'body');
    // a horizontal sheet (floor: up, ceiling: down) cut into tiles of the atlas texture
    const sheet = (x0, x1, z0, z1, y, up, col, tile, hole) => {
      if (hole) {            // [hx0, hx1, hz0, hz1] against the offside wall: the strips round it
        sheet(x0, x1, z0, hole[2], y, up, col, tile); sheet(x0, x1, hole[3], z1, y, up, col, tile); sheet(hole[1], x1, hole[2], hole[3], y, up, col, tile);
        return;
      }
      if (x1 - x0 < 1e-3 || z1 - z0 < 1e-3) return;
      const nx = Math.max(1, Math.round((x1 - x0) / 0.6)), nz = Math.max(1, Math.round((z1 - z0) / 0.6));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const a = x0 + (x1 - x0) * i / nx, c = x0 + (x1 - x0) * (i + 1) / nx, e = z0 + (z1 - z0) * j / nz, f = z0 + (z1 - z0) * (j + 1) / nz;
        quad([[a, y, e], [c, y, e], [c, y, f], [a, y, f]], col, [0, up, 0], tile);
      }
    };
    // a side wall with its window band: panel below the sill, header above, the hull's pillars across the glass
    const sideWall = (sx, y0, sill, head, y1, z0, z1, g0, g1, door) => {
      const x = sx * W, n = [-sx, 0, 0];
      const q = (za, zb, ya, yb, col) => { if (zb - za > 1e-3 && yb - ya > 1e-3) quad([[x, ya, za], [x, ya, zb], [x, yb, zb], [x, yb, za]], col, n); };
      const solid = (za, zb) => { q(za, zb, y0, sill, COL.panelLo); q(za, zb, sill, y1, COL.panel); };
      solid(z0, g0);
      q(g0, g1, y0, sill, COL.panelLo); q(g0, g1, head, y1, COL.panel);
      q(g0, g0 + 0.06, sill, head, COL.pillar); q(g1 - 0.06, g1, sill, head, COL.pillar);
      for (const pz of PILLARS) if (pz > g0 + 0.2 && pz < g1 - 0.2) q(pz - 0.05, pz + 0.05, sill, head, COL.pillar);
      // the sill and the header as ledges the depth of the wall
      box(0.07, 0.035, g1 - g0, sx * (W + 0.03), sill - 0.012, (g0 + g1) / 2, COL.pillar, sx > 0 ? '03' : '13');
      box(0.07, 0.03, g1 - g0, sx * (W + 0.03), head + 0.012, (g0 + g1) / 2, COL.pillar, sx > 0 ? '02' : '12');
      if (door) { solid(g1, door[0]); q(door[0], door[1], door[2], y1, COL.panel); solid(door[1], z1); } else solid(g1, z1);
    };
    // an end wall with a window in it (facing dir along z: +1 = the rear wall seen from inside, -1 = the front one)
    const endWall = (z, dir, y0, y1, hw, win) => {
      const n = [0, 0, dir];
      const q = (xa, xb, ya, yb, col) => { if (xb - xa > 1e-3 && yb - ya > 1e-3) quad([[xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z]], col, n); };
      if (!win) { q(-hw, hw, y0, y1, COL.panel); return; }
      q(-hw, hw, y0, win[2], COL.panelLo); q(-hw, hw, win[3], y1, COL.panel);
      q(-hw, win[0], win[2], win[3], COL.pillar); q(win[1], hw, win[2], win[3], COL.pillar);
    };

    // ------------------------------------------------------------ shell, deck by deck
    for (let d = 0; d < D.floor.length; d++) {
      const y0 = D.floor[d], y1 = D.ceil[d], sill = D.sill[d], head = D.head[d], top = d === D.floor.length - 1;
      const z0 = d === 0 ? -4.45 : -4.98, z1 = d === 0 ? 5.2 : 5.15;
      const hole = dd ? [STAIR.x0 - 0.1, STAIR.x1, d === 0 ? STAIR.z0 : STAIR.zTop, STAIR.zEnd] : null;      // (the stairwell: through the lower ceiling over the whole flight, through the upper floor from the head of the stairs forwards)
      sheet(-W, W, z0, z1, y0, 1, COL.floor, 'busFloor', d === 1 ? hole : null);
      // walls go up to where the ceiling meets them: the top deck has a coving under the curve of the roof
      const wt = top ? Math.min(y1 - 0.18, head + 0.26) : y1;
      sideWall(1, y0, sill, head, wt, z0, z1, D.glassZ[d][0], D.glassZ[d][1], d === 0 ? [DOOR.z0, DOOR.z1, y0 + 1.76] : null);
      sideWall(-1, y0, sill, head, wt, z0, z1, D.glassZ[d][0], D.glassZ[d][2], null);
      if (top) {
        for (const sx of [1, -1]) quad([[sx * W, wt, z0], [sx * W, wt, z1], [sx * (W - 0.2), y1, z1], [sx * (W - 0.2), y1, z0]], COL.ceil, [-sx, -1, 0]);
        sheet(-(W - 0.2), W - 0.2, z0, z1, y1, -1, COL.ceil, null, null);
      } else sheet(-W, W, z0, z1, y1, -1, COL.ceil, null, hole);
      if (d === 0) {
        endWall(z0, 1, y0, y1, W, dd ? null : [-0.95, 0.95, 1.5, 2.18]);
        endWall(z1, -1, y0, y1, W, [-1.0, 1.0, 1.1, Math.min(2.27, y1 - 0.04)]);
      } else {
        endWall(z0, 1, y0, y1, W, [-0.95, 0.95, 2.78, 3.5]);
        endWall(z1, -1, y0, y1, W, [-0.98, 0.98, 2.96, 3.7]);
      }
      // strip lights down the ceiling (they are what the saloon glow is "from")
      for (const sx of [1, -1]) { box(0.09, 0.012, z1 - z0 - 1.2, sx * 0.62, y1 - 0.008, (z0 + z1) / 2, COL.white, '2'); b.last.glow = kit.GLOW.lights; }
    }

    // ------------------------------------------------------------ doors: two glazed leaves that slide apart
    {
      const x = W - 0.03, top = yL + 1.76;
      const leaf = (za, zb, pv) => {
        const n0 = b.pieces.length, zm = (za + zb) / 2, w = zb - za;
        box(0.035, top - yL - 0.02, 0.05, x, (top + yL) / 2, za + 0.025, COL.dark); box(0.035, top - yL - 0.02, 0.05, x, (top + yL) / 2, zb - 0.025, COL.dark);
        box(0.035, 0.05, w, x, top - 0.035, zm, COL.dark); box(0.035, 0.05, w, x, yL + 0.86, zm, COL.dark);
        box(0.03, 0.36, w, x, yL + 0.19, zm, COL.dark);
        rod([x - 0.05, yL + 0.95, zm], [x - 0.05, yL + 1.55, zm], 0.014, COL.rail, 6);
        for (let i = n0; i < b.pieces.length; i++) b.pieces[i].wheel = [x, pv, zm, 1];
      };
      leaf(DOOR.z0, DOOR.zc, DOOR_PIVOT); leaf(DOOR.zc, DOOR.z1, -DOOR_PIVOT);
      box(0.05, 0.02, DOOR.z1 - DOOR.z0, W - 0.06, yL + 0.012, DOOR.zc, COL.rail, '3');          // the yellow edge of the step
    }

    // ------------------------------------------------------------ cab, entrance, luggage pen, wheel boxes
    {
      const y1 = D.ceil[0];
      box(0.95, 0.24, 1.7, -0.725, yL + 0.12, 4.35, COL.step, '3');                                // cab floor (the driver sits a step up)
      box(0.95, y1 - yL, 0.04, -0.725, (yL + y1) / 2, STAIR.zEnd + 0.02, COL.cab);                 // the partition behind the driver
      box(0.04, 0.98, 1.05, -0.25, yL + 0.49, 4.07, COL.cab);                                      // cab door (half height)
      box(0.2, 0.2, 0.16, -0.2, yL + 1.08, 4.42, COL.dash); box(0.14, 0.035, 0.2, -0.13, yL + 1.0, 4.42, COL.panel);   // ticket machine, its tray
      box(0.95, 0.5, 0.3, -0.725, yL + 0.24 + 0.55, 5.03, COL.dash);                               // dashboard
      box(0.46, 0.1, 0.44, -0.75, 0.5 + 0.42, 4.33, COL.shell); box(0.46, 0.66, 0.08, -0.75, 0.5 + 0.78, 4.07, COL.shell);   // driver's seat
      b.rod([-0.75, 1.36, 4.78], [-0.75, 1.385, 4.8], 0.2, 14, COL.wheel, 'body', 0.2, false);     // steering wheel (a tilted disc)
      rod([-0.75, 1.0, 4.95], [-0.75, 1.37, 4.79], 0.025, COL.dash, 6);
      box(1.45, 0.5, 0.3, 0.475, yL + 0.25, 5.03, COL.dash);                                       // the shelf under the nearside windscreen
      // entrance poles
      rod([0.55, yL, DOOR.z0 - 0.04], [0.55, y1, DOOR.z0 - 0.04], 0.017, COL.rail); rod([-0.22, yL, DOOR.z1 + 0.1], [-0.22, y1, DOOR.z1 + 0.1], 0.017, COL.rail);
      // luggage pen over the nearside front wheel (and the offside one on a single-decker; the stairs cover it otherwise)
      for (const sx of dd ? [1] : [1, -1]) {
        const zc = AXLES[0];
        box(W - 0.42, 0.82, 1.14, sx * (0.42 + W) / 2, yL + 0.41, zc, COL.box);
        for (const z of [zc - 0.55, zc + 0.55]) rod([sx * 0.44, yL + 0.82, z], [sx * 0.44, yL + 1.12, z], 0.015, COL.rail, 6);
        rod([sx * 0.44, yL + 1.12, zc - 0.55], [sx * 0.44, yL + 1.12, zc + 0.55], 0.015, COL.rail, 6);
        box(0.02, 0.9, 0.04, sx * 0.44, yL + 0.45, zc - 0.585, COL.shell);                         // modesty panel edge towards the seats
      }
      // the back wheels' boxes (the tyres come up inside the saloon wall)
      for (const sx of [1, -1]) box(W - 0.76, 0.82, 1.14, sx * (0.76 + W) / 2, yL + 0.41, AXLES[1], COL.box);
    }

    // ------------------------------------------------------------ stairs (double-decker)
    // (2026-11-23: a straight flight RISING REARWARDS from a landing against the cab partition: _busride_logic.js STAIR,
    //  a guess after the Enviro400 / Gemini layout. Every tread is solid to the floor: the offside front wheel is in there.)
    if (dd) {
      const yU = D.floor[1], yC = D.ceil[0], xm = (STAIR.x0 + STAIR.x1) / 2, w = STAIR.x1 - STAIR.x0, rise = (yU - STAIR.yLand) / STAIR.n;
      box(w, STAIR.yLand - yL, STAIR.zEnd - STAIR.zFoot, xm, (STAIR.yLand + yL) / 2, (STAIR.zFoot + STAIR.zEnd) / 2, COL.step, '3');      // the landing at the foot
      box(0.05, 0.025, STAIR.zEnd - STAIR.zFoot, STAIR.x1 - 0.025, STAIR.yLand + 0.004, (STAIR.zFoot + STAIR.zEnd) / 2, COL.rail);     // its yellow edge, towards the aisle
      for (let k = 1; k < STAIR.n; k++) {
        const za = STAIR.zFoot - STAIR.tread * k, zb = za + STAIR.tread, y = STAIR.yLand + rise * k;
        box(w, y - yL, STAIR.tread, xm, (y + yL) / 2, (za + zb) / 2, COL.step, '3');
        box(w, 0.025, 0.045, xm, y + 0.004, zb - 0.022, COL.rail);                                     // nosing
      }
      box(w, yU - yL, STAIR.zTop - STAIR.z0, xm, (yU + yL) / 2, (STAIR.z0 + STAIR.zTop) / 2, COL.step, '23');      // the last riser, up to the upper floor
      box(w, 0.025, 0.045, xm, yU + 0.004, STAIR.zTop - 0.022, COL.rail);
      // the enclosure: its back (lower deck), its side along the lower aisle (open over the landing), the screen round the
      // stairwell upstairs (open at the head of the stairs) and the slab's edge between
      box(w, yU - yL, 0.035, xm, (yU + yL) / 2, STAIR.z0 - 0.018, COL.cab);
      box(0.035, yC - yL, STAIR.zFoot - STAIR.z0, STAIR.x1 + 0.018, (yC + yL) / 2, (STAIR.z0 + STAIR.zFoot) / 2, COL.cab);
      box(0.035, yU + 0.95 - yC, STAIR.zEnd - STAIR.zTop, STAIR.x1 + 0.018, (yU + 0.95 + yC) / 2, (STAIR.zTop + STAIR.zEnd) / 2, COL.cab);
      box(w, 0.95, 0.035, xm, yU + 0.475, STAIR.zEnd + 0.018, COL.cab);
      // handrails up both sides, a pole at the head and one at the foot
      rod([STAIR.x0 + 0.07, STAIR.yLand + 0.95, STAIR.zFoot + 0.2], [STAIR.x0 + 0.07, yU + 0.95, STAIR.zTop - 0.05], 0.017, COL.rail);
      rod([STAIR.x1 - 0.06, STAIR.yLand + 0.95, STAIR.zFoot], [STAIR.x1 - 0.06, yU + 0.95, STAIR.zTop + 0.1], 0.017, COL.rail);
      rod([STAIR.x1 + 0.04, yU, STAIR.zTop + 0.04], [STAIR.x1 + 0.04, D.ceil[1], STAIR.zTop + 0.04], 0.017, COL.rail);
      rod([STAIR.x1 + 0.06, yL, STAIR.zFoot - 0.02], [STAIR.x1 + 0.06, yC, STAIR.zFoot - 0.02], 0.017, COL.rail);
    }

    // ------------------------------------------------------------ seats, grab rails, poles, bell pushes
    {
      const seen = new Set();
      for (const s of S) {
        const y = s.y, y1 = D.ceil[s.deck];
        box(0.41, 0.1, 0.43, s.x, y + 0.4, s.z + 0.115, COL.moq, '3').tile('busMoq');
        box(0.41, 0.6, 0.075, s.x, y + 0.75, s.z - 0.165, COL.moq, '35').tile('busMoq');
        box(0.43, 0.66, 0.02, s.x, y + 0.74, s.z - 0.212, COL.shell, '34');
        box(0.43, 0.03, 0.1, s.x, y + 1.06, s.z - 0.17, COL.shell, '3');
        if (s.bench) { if (s.x === 0) box(2.1, 0.35, 0.36, 0, y + 0.175, s.z + 0.1, COL.shell, '23'); continue; }
        const rk = s.deck + ':' + s.side + ':' + s.z;
        if (!seen.has(rk)) {
          seen.add(rk);
          const ax = s.side * (s.edge + 0.02), pole = Math.round((s.z + 6) / BUS.pitch) % 2 === 0;
          box(0.06, 0.35, 0.3, s.side * (s.edge + BUS.seatW * (s.win ? 1 : 0.5)), y + 0.175, s.z + 0.08, COL.shell, '23');   // pedestal
          // grab rail along the top of the back; every other row a pole to the ceiling with a bell push
          rod([ax, y + 1.03, s.z - 0.17], [ax, y + 1.13, s.z - 0.17], 0.014, COL.rail, 6);
          rod([ax, y + 1.13, s.z - 0.17], [ax + s.side * 0.3, y + 1.13, s.z - 0.17], 0.014, COL.rail, 6);
          rod([ax + s.side * 0.3, y + 1.13, s.z - 0.17], [ax + s.side * 0.3, y + 1.05, s.z - 0.17], 0.014, COL.rail, 6);
          if (pole) {
            rod([ax, y + 1.13, s.z - 0.17], [ax, y1, s.z - 0.17], 0.017, COL.rail);
            box(0.042, 0.06, 0.042, ax, y + 1.38, s.z - 0.17, COL.bell); box(0.018, 0.024, 0.05, ax, y + 1.383, s.z - 0.17, COL.rail);
          }
        }
      }
    }

    // ------------------------------------------------------------ the displays: next stop (always lit), BUS STOPPING (flag 8)
    const display = (y, z, x0, x1) => {
      box(x1 - x0 + 0.04, 0.125, 0.05, (x0 + x1) / 2, y, z + 0.027, COL.dark, '5');
      const nx = x1 - 0.61, a = y - 0.048, c = y + 0.049;
      acc.decal({ color: COL.white, glow: kit.GLOW.led }, [[x1 - 0.005, a, z], [nx, a, z], [nx, c, z], [x1 - 0.005, c, z]], 'busNext', [0, 0, -1]);
      acc.decal({ color: COL.sign, glow: kit.GLOW.beaconA }, [[nx - 0.02, y - 0.032, z], [x0 + 0.005, y - 0.032, z], [x0 + 0.005, y + 0.032, z], [nx - 0.02, y + 0.032, z]], 'busStopping', [0, 0, -1]);
    };
    display(D.ceil[0] - (dd ? 0.07 : 0.2), 3.44, -0.38, 0.6);
    if (dd) display(D.ceil[1] - 0.09, 5.13, -0.49, 0.49);

    acc.flush(b);
    for (const p of b.pieces) if (!p.glow) p.glow = SAL;
  });
}

/** The interior mesh for a bus rig: an InstancedMesh of 1 in MATS.car. setDoors(0..1), setLights(on), setStopping(on). */
export function makeInterior(style) {
  const geo = interiorGeometry(style);
  const m = new THREE.InstancedMesh(geo, MATS.car, 1);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  m.name = 'bus-interior'; m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false;
  const D = m.instanceColor.array;
  let flags = 0, door = 0;
  const put = () => { D[0] = door; D[1] = 0; D[2] = flags; m.instanceColor.needsUpdate = true; };
  m.userData.setDoors = (k) => { const a = Math.max(0, Math.min(1, k)) * DOOR_SLIDE / DOOR_PIVOT; if (a !== door) { door = a; put(); } };
  m.userData.setLights = (on) => { const f = on ? flags | FLAG.lights : flags & ~FLAG.lights; if (f !== flags) { flags = f; put(); } };
  m.userData.setStopping = (on) => { const f = on ? flags | FLAG.beaconA : flags & ~FLAG.beaconA; if (f !== flags) { flags = f; put(); } };
  m.userData.state = () => ({ door: door * DOOR_PIVOT / DOOR_SLIDE, lights: !!(flags & FLAG.lights), stopping: !!(flags & FLAG.beaconA) });
  put();
  return m;
}

// ---------------------------------------------------------------- rain on the glass
// Beads and short runs of water on every pane, seen from inside when it rains: one draw in MATS.beam (the headlamp
// beams' additive vertex-coloured material: no texture, no new shader), only made the first time it rains on a ride and
// only shown while it does. Static (the rain itself is the weather system's, falling outside the bus).
const _rain = new Map();
export function makeRain(style) {
  const key = style === 'bus1' ? 'bus1' : 'bus';
  let g = _rain.get(key);
  if (!g) {
    const D = decks(key), pos = [], col = [];
    let s = 4711; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    // a quad in the plane of a pane: (u, y) on the pane -> world by fn; bright at the bead (bottom), nothing at its tail
    const run = (P, u, y, len, w, lean, b) => {
      const a0 = P(u - w, y), a1 = P(u + w, y), b1 = P(u + w + lean, y + len), b0 = P(u - w + lean, y + len);
      for (const q of [a0, a1, b1, a0, b1, b0]) pos.push(q[0], q[1], q[2]);
      for (const k of [b, b, 0.04, b, 0.04, 0.04]) col.push(k * 0.8, k * 0.9, k);
    };
    const pane = (P, u0, u1, y0, y1, lean) => {
      const n = Math.round((u1 - u0) * (y1 - y0) * 60);
      for (let i = 0; i < n; i++) {
        const u = u0 + r() * (u1 - u0), y = y0 + r() * (y1 - y0 - 0.06), bead = r() < 0.55;
        if (bead) run(P, u, y, 0.005 + r() * 0.006, 0.0022 + r() * 0.002, 0, 0.1 + r() * 0.14);
        else { const len = 0.02 + r() * 0.05; run(P, u, y, Math.min(len, y1 - y - 0.01), 0.0011 + r() * 0.001, lean * len, 0.07 + r() * 0.11); }
      }
    };
    for (let d = 0; d < D.floor.length; d++) {
      const y0 = D.sill[d] + 0.02, y1 = D.head[d] - 0.02, gz = D.glassZ[d];
      // the side panes (wound to face inwards), the runs leaning back the way the bus's speed drags them
      pane((u, y) => [BUS.wall + 0.035, y, u], gz[0] + 0.08, gz[1] - 0.08, y0, y1, 0.4);
      pane((u, y) => [-(BUS.wall + 0.035), y, -u], -(gz[2] - 0.08), -(gz[0] + 0.08), y0, y1, -0.4);
    }
    pane((u, y) => [-u, y, 5.24], -1.0, 1.0, 1.12, Math.min(2.25, D.ceil[0] - 0.06), 0);                   // the windscreen
    if (D.dd) pane((u, y) => [-u, y, 5.19], -0.98, 0.98, 2.98, 3.68, 0);                                    // the upstairs front window
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    _rain.set(key, g);
  }
  const m = new THREE.Mesh(g, MATS.beam);
  m.name = 'bus-rain'; m.castShadow = false; m.frustumCulled = false; m.renderOrder = 2;
  return m;
}

// ---------------------------------------------------------------- the people aboard
const DRIVER = { topStyle: 'shirt', top: 0xb9cde3, sleeves: 'short', bottom: 0x23262d, jacket: undefined, hivis: 0xd9ec2a };
const _figs = new Map();          // look key -> baked seated body (kept: the same few people ride every bus)
export function figure(key, look, pose) {
  let g = _figs.get(key);
  if (!g) {
    g = bakeCharacterGeometry(look, pose, 14);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    _figs.set(key, g);
  }
  return g;
}
/** The look of the passenger drawn at a window with these colours (stable: same colours, same person). */
function paxLook(q, i) {
  const L = randomLook(7000 + (q.top % 97) * 13 + (q.hair % 31) * 7 + i, { outfit: 'casual' });
  L.top = q.top; L.skin = q.skin; L.hair = q.hair;
  return L;
}
/**
 * The passengers and the driver of a bus as a list of jobs, so the caller can bake one a frame (a body is a few ms):
 *   const P = paxPlan(style, n, seed, driver);  while (!P.done) P.step();  P.mesh() -> THREE.Mesh | null
 * P.seats = the seat indices they occupy.
 */
/** Who is aboard and where, as bake jobs: [{ key, look, pose, x, y, z }] (the people of paxPlan; systems/_carfid.js
 *  draws the same people in the same seats through the windows from the street) */
export function paxJobs(style, n, seed, driver = true) {
  const S = seatLayout(style), who = paxSeats(style, busPaxLayout(n, seed));
  const jobs = who.map((w, i) => ({ key: 'p' + w.top + ':' + w.skin + ':' + w.hair + ':' + (i % 3), look: paxLook(w, i % 3), pose: 'sit', x: S[w.seat].x, y: S[w.seat].y, z: S[w.seat].z, seat: w.seat }));
  if (driver) jobs.push({ key: 'driver', look: Object.assign(randomLook(4242), DRIVER), pose: 'drive', x: -0.75, y: 0.5, z: 4.35, seat: -1 });
  return jobs;
}
export function paxPlan(style, n, seed, driver = true) {
  const jobs = paxJobs(style, n, seed, driver), who = jobs.filter((j) => j.seat >= 0);
  const parts = [];
  let i = 0;
  const P = {
    seats: who.map((w) => w.seat), count: jobs.length,
    get done() { return i >= jobs.length; },
    step() {
      if (i >= jobs.length) return false;
      const j = jobs[i++];
      try { const g = figure(j.key, j.look, j.pose).clone(); g.translate(j.x, j.y, j.z); parts.push(g); } catch (e) { console.warn('[busride] passenger', e); }
      return true;
    },
    mesh() {
      if (!parts.length) return null;
      let g = null;
      try { g = mergeGeometries(parts, false); } catch (e) { console.warn('[busride] passengers', e); }
      for (const q of parts) q.dispose();
      parts.length = 0;
      if (!g) return null;
      const m = new THREE.Mesh(g, characterMaterial);
      m.name = 'bus-people'; m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false;
      // after dark the same bodies are drawn by the bus's own material instead, lit by the saloon lamps like the seats
      // (never both: still one draw; the character material has no lamp of its own to be lit by in here)
      try {
        carAttrs(g, GLOW.cabin);
        const n = new THREE.InstancedMesh(g, MATS.car, 1);
        n.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array([0, 0, FLAG.lights]), 3);
        n.name = 'bus-people-lit'; n.castShadow = false; n.receiveShadow = true; n.frustumCulled = false; n.visible = false;
        m.userData.night = n;
      } catch (e) { console.warn('[busride] people at night', e); }
      return m;
    },
  };
  return P;
}
