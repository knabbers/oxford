// Dynamic props: what each knockable thing is (pure data + the split meshes of bins). Used by systems/props.js;
// the solver is _props_physics.js. Shapes are given in the ITEM frame (origin on the ground at the item's foot,
// +z = the side facing the street, as the streetscape prototypes are modelled); `com` is the centre of mass there.
//
//   cls   free      knocked by anything that hits it hard enough for its mass (walk: a walker nudges it; sprint: a
//                   runner knocks it and stumbles; otherwise only wheels)
//         anchored  bolted down: solid below a momentum threshold (breakP N·s and minV m/s), above it the post
//                   shears at the base and falls (the vehicle pays part of breakP as lost momentum)
//         bend      bollards: above the threshold they fold over at the foot and stay bent
//         solid     never moves (post boxes, phone boxes, shelters, cabinets): a heavy thud
//   mat   sound family: plastic | metal | iron | wood | rubber | glass
//   lid   'hinge' (wheelie bins: flaps open with gravity) | 'pop' (litter bins: flies off on a hard hit)
//   litter  how many bits spill when it goes over; float = buoyancy / weight (> 1 floats)
import { PB } from './_street_geo.js';

const IRON = 0x15171a, GOLD = 0xb8923a;
const cyl = (r0, r1, h, y = 0) => ({ shape: 'cyl', y0: y, y1: y + h, r0, r1 });
const box = (w, h, d, x = 0, y = 0, z = 0) => ({ shape: 'box', c: [x, y + h / 2, z], h: [w / 2, h / 2, d / 2] });

const SIGN = { cls: 'anchored', mass: 14, ...box(0.12, 2.7, 0.12), com: [0, 1.3, 0], pts: [[0, 2.6, 0.04]], mat: 'metal', breakP: 700, minV: 1.6, e: 0.3, mu: 0.5, roll: 1.5, float: 0.5, heat: 0.5 };

export const KINDS = {
  // ---- streetscape items
  lampH: { cls: 'anchored', lamp: true, mass: 180, ...cyl(0.14, 0.09, 4.4), com: [0, 1.5, 0], pts: [[0, 4.6, 0], [0.31, 3.6, 0], [-0.31, 3.6, 0]], mat: 'iron', breakP: 8500, minV: 5, e: 0.22, mu: 0.55, roll: 2.5, float: 0.3, heat: 4, Ik: 1.3 },
  lampS: { cls: 'anchored', lamp: true, mass: 220, ...cyl(0.1, 0.07, 7.9), com: [0, 2.6, 0.1], pts: [[0, 7.9, 1.4], [0, 7.9, 0.4]], mat: 'metal', breakP: 10000, minV: 5.5, e: 0.25, mu: 0.5, roll: 2.5, float: 0.3, heat: 4, Ik: 1.2 },
  lampR: { cls: 'anchored', lamp: true, mass: 140, ...cyl(0.08, 0.06, 5.5), com: [0, 1.9, 0.05], pts: [[0, 5.6, 0.75]], mat: 'metal', breakP: 7000, minV: 4.5, e: 0.25, mu: 0.5, roll: 2.5, float: 0.3, heat: 4, Ik: 1.2 },
  binC: { cls: 'free', sprint: true, mass: 30, ...cyl(0.19, 0.21, 0.94), com: [0, 0.4, 0], mat: 'iron', lid: 'pop', litter: 9, e: 0.2, mu: 0.6, roll: 0.9, float: 0.8, heat: 0.3 },
  binP: { cls: 'free', sprint: true, mass: 22, ...cyl(0.24, 0.27, 0.92), com: [0, 0.4, 0], mat: 'plastic', lid: 'pop', litter: 8, e: 0.25, mu: 0.6, roll: 0.8, float: 1.8, heat: 0.3 },
  wheelieG: { cls: 'free', walk: true, mass: 16, ...box(0.6, 1.0, 0.76, 0, 0.05, 0), com: [0, 0.48, 0.02], wheels: { pts: [[0.25, 0, -0.3], [-0.25, 0, -0.3]], axle: [1, 0, 0], mu: 0.04 }, mat: 'plastic', lid: 'hinge', hinge: [0, 1.045, -0.4], litter: 6, e: 0.3, mu: 0.55, roll: 0.9, float: 2.2, heat: 0.2 },
  wheelieB: null,
  caddy: { cls: 'free', walk: true, mass: 3, ...box(0.32, 0.36, 0.3), com: [0, 0.16, 0], mat: 'plastic', litter: 3, e: 0.3, mu: 0.5, roll: 1, float: 2, heat: 0 },
  recBox: { cls: 'free', walk: true, mass: 4, ...box(0.6, 0.36, 0.42), com: [0, 0.15, 0], mat: 'plastic', litter: 5, glassy: true, e: 0.25, mu: 0.55, roll: 1, float: 1.6, heat: 0 },
  cone: { cls: 'free', walk: true, mass: 1.6, ...cyl(0.19, 0.03, 0.71), com: [0, 0.2, 0], mat: 'rubber', e: 0.35, mu: 0.7, roll: 0.5, float: 2.5, heat: 0 },
  aboard: { cls: 'free', walk: true, mass: 7, ...box(0.62, 0.94, 0.44), com: [0, 0.45, 0], mat: 'wood', e: 0.25, mu: 0.5, roll: 1.2, float: 1.8, heat: 0.1 },
  agent: { cls: 'free', mass: 9, ...box(0.12, 2.75, 0.9, 0, 0, 0.35), com: [0, 1.6, 0.25], mat: 'wood', e: 0.25, mu: 0.5, roll: 1.5, float: 1.5, heat: 0.2 },
  bike: { cls: 'free', sprint: true, mass: 14, ...box(1.7, 1.0, 0.35), com: [0, 0.5, 0], mat: 'metal', e: 0.3, mu: 0.5, roll: 1.5, float: 0.6, heat: 0.3 },
  bench: { cls: 'free', mass: 45, ...box(1.7, 0.9, 0.48), com: [0, 0.4, 0], mat: 'wood', e: 0.2, mu: 0.6, roll: 1.5, float: 1.2, heat: 0.5 },
  grit: { cls: 'free', mass: 45, ...box(0.84, 0.72, 0.6), com: [0, 0.32, 0], mat: 'plastic', e: 0.25, mu: 0.6, roll: 1.2, float: 1.3, heat: 0.4 },
  payMachine: { cls: 'anchored', mass: 160, ...box(0.42, 1.75, 0.3), com: [0, 1.05, 0], mat: 'metal', breakP: 8000, minV: 5, e: 0.2, mu: 0.6, roll: 2, float: 0.4, heat: 3 },
  pedSig: { cls: 'anchored', mass: 90, ...cyl(0.07, 0.07, 3.1), com: [0, 1.6, 0], pts: [[0.25, 2.4, 0], [0, 3.1, 0.15]], mat: 'metal', breakP: 5500, minV: 4, e: 0.25, mu: 0.5, roll: 2, float: 0.4, heat: 3 },
  bollard: { cls: 'bend', mass: 60, ...cyl(0.085, 0.07, 0.95), com: [0, 0.43, 0], mat: 'iron', breakP: 5000, minV: 4, e: 0.2, mu: 0.6, roll: 1, float: 0.3, heat: 1 },
  noEntry: SIGN, oneWay: SIGN, limit20: SIGN, cycle: SIGN, pay: SIGN, permit: SIGN,
  postBox: { cls: 'solid', mat: 'iron' }, cabinet: { cls: 'solid', mat: 'metal', block: true },
  // ---- world furniture (world/furniture.js InstanceSets; prefixed f.)
  'f.bench': { cls: 'free', mass: 50, ...box(1.8, 0.95, 0.52), com: [0, 0.42, -0.02], mat: 'wood', e: 0.2, mu: 0.6, roll: 1.5, float: 1.2, heat: 0.5, col: { box: [1.8, 0.5] } },
  'f.bin': { cls: 'free', sprint: true, mass: 28, ...cyl(0.21, 0.235, 0.95), com: [0, 0.4, 0], mat: 'iron', litter: 8, e: 0.2, mu: 0.6, roll: 0.9, float: 0.8, heat: 0.3 },
  'f.picnic': { cls: 'free', mass: 70, ...box(1.8, 0.77, 1.4), com: [0, 0.45, 0], mat: 'wood', e: 0.2, mu: 0.6, roll: 1.5, float: 1.2, heat: 0.5, col: { box: [1.8, 1.3] } },
  'f.bollard': { cls: 'bend', mass: 60, ...cyl(0.085, 0.072, 0.95), com: [0, 0.42, 0], mat: 'iron', breakP: 5000, minV: 4, e: 0.2, mu: 0.6, roll: 1, float: 0.3, heat: 1, col: { r: 0.11 } },
  'f.signal': { cls: 'anchored', mass: 100, ...cyl(0.07, 0.07, 3.15), com: [0, 1.8, 0.05], pts: [[0, 3.15, 0.1]], mat: 'metal', breakP: 6500, minV: 4.5, e: 0.25, mu: 0.5, roll: 2, float: 0.4, heat: 3, col: { r: 0.09 } },
  'f.belisha': { cls: 'anchored', mass: 35, ...cyl(0.06, 0.06, 2.7), com: [0, 1.4, 0], pts: [[0, 2.7, 0]], mat: 'metal', glassy: true, breakP: 2200, minV: 3, e: 0.3, mu: 0.5, roll: 1.5, float: 0.5, heat: 2, col: { r: 0.07 } },
  'f.busStop': { cls: 'anchored', mass: 30, ...cyl(0.05, 0.05, 2.7), com: [0, 1.5, 0], pts: [[0, 2.6, 0]], mat: 'metal', breakP: 2200, minV: 3, e: 0.3, mu: 0.5, roll: 1.5, float: 0.5, heat: 1, col: { r: 0.06 } },
  'f.postBox': { cls: 'solid', mat: 'iron', col: { r: 0.29 } },
  'f.phone': { cls: 'solid', mat: 'iron', col: { box: [0.98, 0.98] } },
  'f.shelter': { cls: 'solid', mat: 'glass', col: { shelter: true } },
  'f.lampPost': { cls: 'solid', mat: 'iron', col: { r: 0.13 } },
  // ---- footballs in the parks (not map items)
  ball: { cls: 'free', walk: true, mass: 0.43, shape: 'sphere', r: 0.11, hollow: true, com: [0, 0.11, 0], mat: 'ball', e: 0.72, mu: 0.45, roll: 0.35, float: 8, heat: 0 },
  // the lid of a litter bin, once it has flown off
  lid: { cls: 'free', walk: true, mass: 2, ...cyl(0.29, 0.12, 0.12), com: [0, 0.04, 0], mat: 'metal', e: 0.3, mu: 0.5, roll: 0.6, float: 1.5, heat: 0 },
};
KINDS.wheelieB = KINDS.wheelieG;

/** vehicle masses (kg, with driver) by vehicles TYPES key */
export const VMASS = { car_hatch: 1150, car_saloon: 1450, taxi: 1900, van: 2300, bus: 12000, bike_roadster: 95, bike_road: 85, bike_mtb: 92 };

/** split prototypes for the bins (body + lid separately, so the lid can flap or fly); same look as _street_geo.js */
export function splitProtos() {
  const pb = () => new PB();
  const out = {};
  out.binC = {
    body: pb().color(IRON).cyl(0, 0, 0, 0.18, 0.2, 0.66, 8, { top: false }).color(GOLD).cyl(0, 0.46, 0, 0.203, 0.203, 0.05, 8, { top: false }).color(0x020202).cyl(0, 0.66, 0, 0.16, 0.16, 0.14, 8, { top: false }).color(0x070707).cyl(0, 0.74, 0, 0.16, 0.16, 0.001, 8, { top: true }).done(),
    lid: pb().color(IRON).cyl(0, 0.8, 0, 0.21, 0.21, 0.04, 8, { top: false }).color(GOLD).cyl(0, 0.84, 0, 0.212, 0.212, 0.02, 8, { top: false }).color(IRON).cyl(0, 0.86, 0, 0.21, 0.07, 0.08, 8).done(),
  };
  out.binP = {
    body: pb().color(0x22382a).cyl(0, 0, 0, 0.22, 0.26, 0.86, 8, { top: false }).color(0x0d0d0d).box(0, 0.62, 0.25, 0.22, 0.12, 0.04).color(0x070707).cyl(0, 0.8, 0, 0.25, 0.25, 0.001, 8, { top: true }).done(),
    lid: pb().color(0x1b2c22).cyl(0, 0.86, 0, 0.28, 0.27, 0.06, 8).done(),
  };
  const wheelie = (col) => ({
    body: pb().color(col).box(0, 0.06, 0, 0.58, 0.96, 0.7, { taperX: 1.05, taperZ: 1.08, top: false }).color(0x0a0a0a).box(0, 0.9, 0, 0.56, 0.001, 0.72).color(0x111111).box(-0.25, 0, -0.3, 0.06, 0.2, 0.2).box(0.25, 0, -0.3, 0.06, 0.2, 0.2).color(col, 0.7).box(0, 0.92, -0.37, 0.5, 0.06, 0.06).done(),
    lid: pb().color(col, 0.8).box(0, 1.02, -0.02, 0.62, 0.05, 0.78).done(),
  });
  out.wheelieG = wheelie(0x2c5a34); out.wheelieB = wheelie(0x245a9a);
  return out;
}

/** body spec (for _props_physics Body) of kind spec K, relative to its centre of mass */
export function bodySpec(K) {
  const c = K.com || [0, 0, 0];
  const s = { shape: K.shape, mass: K.mass, e: K.e, mu: K.mu, roll: K.roll, float: K.float, Ik: K.Ik, hollow: K.hollow };
  if (K.shape === 'box') { s.c = [K.c[0] - c[0], K.c[1] - c[1], K.c[2] - c[2]]; s.h = K.h.slice(); }
  else if (K.shape === 'cyl') { s.y0 = K.y0 - c[1]; s.y1 = K.y1 - c[1]; s.r0 = K.r0; s.r1 = K.r1; }
  else s.r = K.r;
  if (K.pts) s.pts = K.pts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
  if (K.wheels) s.wheels = { axle: K.wheels.axle, mu: K.wheels.mu, pts: K.wheels.pts.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]) };
  return s;
}

/** momentum test for anchored / bend kinds: does a vehicle of mass m closing at vn break it? */
export function breaks(K, m, vn) {
  if (K.cls === 'free') return vn > 0.4;
  if (K.cls === 'solid') return false;
  const minV = m > 5000 ? K.minV * 0.45 : K.minV;
  return vn >= minV && m * vn >= K.breakP;
}

/** deterministic [0,1) from integers (item id, event time, salt) — never Math.random for anything peers must agree on */
export function hashi(a, b, c = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
