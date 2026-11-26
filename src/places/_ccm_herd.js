// Christ Church Meadow — the Longhorn herd's behaviour: a PURE function of the shared clock (no THREE, no DOM), so every
// player sees the same cow in the same place doing the same thing, and a player who arrives late sees exactly what one
// who watched all along sees. Used by _ccm_cattle.js (drawing) and tools/smoke_ccm.mjs.
//
// Each cow lives in slots of 30-50 s (its own length and offset). In slot k it has a spot P(k): the herd's grazing
// anchor of the moment (it moves every 4 minutes to another of a dozen anchors spread over the field) plus a hashed
// offset, always inside the field with a margin. At the start of a slot it walks from P(k-1) to P(k) at ~0.85 m/s, then
// grazes there (head down, now and then up to look about). Lying is decided per run of three slots, more often at night
// and over midday (rumination); a lying run keeps one spot, so the cow walks there, lies down, and gets up at the end.
import { pointInPoly, distToPoly } from './_ccm_map.js';

import { HOUR_MS, DAY_MS } from '../core/time.js'; export { HOUR_MS, DAY_MS };
const BLOCK_MS = 900000, WALK = 0.85, STRIDE = 1.7, MARGIN = 3.5;

/** integer-ish hash -> [0,1) */
export function hh(a, b = 0, c = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
/** how likely a cow is to be lying down at this hour (cattle rest at night and ruminate over the middle of the day) */
export function lieChance(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5 || h >= 21.5) return 0.72;
  if (h < 7) return 0.35;
  if (h < 11) return 0.08;
  if (h < 15) return 0.42;
  if (h < 19) return 0.12;
  return 0.3;
}
export const hourOf = (ms) => (((ms % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS;

/**
 * The herd: fields = [{poly, holes?, n}] -> a herd object. cows[i] = {field, seed, slot, off}.
 * Anchors are drawn once (deterministically) inside each field.
 */
export function makeHerd(fields) {
  const herd = { fields: [], cows: [] };
  fields.forEach((f, fi) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of f.poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    const ok = (x, z, m) => pointInPoly(x, z, f.poly) && distToPoly(x, z, f.poly) >= m && !(f.holes || []).some((h) => pointInPoly(x, z, h) || distToPoly(x, z, h) < m);
    const anchors = [];
    for (let k = 0; anchors.length < 12 && k < 4000; k++) {
      const x = minX + (maxX - minX) * hh(fi + 11, k, 1), z = minZ + (maxZ - minZ) * hh(fi + 11, k, 2);
      if (ok(x, z, 22) && anchors.every((a) => Math.hypot(a[0] - x, a[1] - z) > 30)) anchors.push([x, z]);
    }
    if (!anchors.length) for (let k = 0; anchors.length < 1 && k < 4000; k++) { const x = minX + (maxX - minX) * hh(fi + 7, k, 1), z = minZ + (maxZ - minZ) * hh(fi + 7, k, 2); if (ok(x, z, MARGIN + 1)) anchors.push([x, z]); }
    // a tour round the anchors (sorted by angle about their centre), so the herd drifts from one to the next
    { let cx = 0, cz = 0; for (const a of anchors) { cx += a[0] / anchors.length; cz += a[1] / anchors.length; } anchors.sort((a, b) => Math.atan2(a[1] - cz, a[0] - cx) - Math.atan2(b[1] - cz, b[0] - cx)); }
    herd.fields.push({ poly: f.poly, holes: f.holes || [], ok, anchors, bb: [minX, maxX, minZ, maxZ] });
    for (let i = 0; i < f.n; i++) {
      const id = herd.cows.length, seed = hh(id, 77, 3);
      herd.cows.push({ id, field: fi, seed, slotMs: 30000 + 20000 * hh(id, 5), offMs: Math.floor(hh(id, 9) * 60000) });
    }
  });
  return herd;
}

/** the herd's grazing centre at time t (ms): it walks the field's anchors in tour order, one per block, eased */
function anchorAt(F, t) {
  const A = F.anchors, b = Math.floor(t / BLOCK_MS), f = t / BLOCK_MS - b, e = smooth(0.15, 0.85, f);
  const a0 = A[((b % A.length) + A.length) % A.length], a1 = A[(((b + 1) % A.length) + A.length) % A.length];
  return [a0[0] + (a1[0] - a0[0]) * e, a0[1] + (a1[1] - a0[1]) * e, a0];
}
/** cow c's place in the herd at time t: a home offset re-drawn per block and eased between blocks */
function homeOffset(c, t) {
  const b = Math.floor(t / BLOCK_MS), e = smooth(0.1, 0.9, t / BLOCK_MS - b);
  const o = (bb) => { const r = 3 + 13 * Math.sqrt(hh(c.id, bb, 41)), th = 6.2831853 * hh(c.id, bb, 61); return [Math.cos(th) * r, Math.sin(th) * r]; };
  const p = o(b), q = o(b + 1);
  return [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e];
}
/** where cow c stands for slot key `key` that began at time t0 (ms) */
function spot(herd, c, key, t0) {
  const ck = c.id * 1e9 + key;
  const cache = herd.cache || (herd.cache = new Map());   // per herd (two herds in one process must not share spots)
  const hit = cache.get(ck); if (hit) return hit;
  const F = herd.fields[c.field], [ax, az, a0] = anchorAt(F, t0), o = homeOffset(c, t0);
  const jr = 3.5 * Math.sqrt(hh(c.id, key, 43)), jt = 6.2831853 * hh(c.id, key, 47);
  let p = null;
  for (const k of [1, 0.6, 0.25]) { const x = ax + (o[0] + Math.cos(jt) * jr) * k, z = az + (o[1] + Math.sin(jt) * jr) * k; if (F.ok(x, z, MARGIN)) { p = [x, z]; break; } }
  if (!p) p = F.ok(ax, az, MARGIN) ? [ax, az] : [a0[0] + o[0] * 0.3, a0[1] + o[1] * 0.3];
  if (cache.size > 4000) cache.clear();
  cache.set(ck, p);
  return p;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const TURN = 2.4;
/** 0..1 -> 0..1 at constant speed with short ramps (peak speed 1.18x the mean) */
const trap = (f) => { const a = 0.15, v = 1 / (1 - a); return f < a ? (v * f * f) / (2 * a) : f > 1 - a ? 1 - (v * (1 - f) * (1 - f)) / (2 * a) : v * (f - a / 2); };
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; };

/** the slot plan of cow c for slot k: where it walks from/to, when it arrives, and which way it then faces */
function plan(herd, c, k, hourAt) {
  const S = c.slotMs;
  const lieRun = (kk) => hh(c.id, Math.floor(kk / 3), 91) < lieChance(hourAt(Math.floor(kk / 3) * 3 * S - c.offMs));
  const lying = lieRun(k), ka = lying ? Math.floor(k / 3) * 3 : k;              // the slot in which it walked to this spot
  const key = lying ? -1 - Math.floor(k / 3) : k;
  const kp = ka - 1, prevLying = lieRun(kp), keyP = prevLying ? -1 - Math.floor(kp / 3) : kp;
  const tA = ka * S - c.offMs, tP = (prevLying ? Math.floor(kp / 3) * 3 : kp) * S - c.offMs;
  const P1 = spot(herd, c, key, tA), P0 = spot(herd, c, keyP, tP);
  const dx = P1[0] - P0[0], dz = P1[1] - P0[1], d = Math.hypot(dx, dz);
  const dur = d > 0.3 ? Math.min((S / 1000) * 0.7, d / WALK) : 0;
  const hWalk = d > 0.3 ? Math.atan2(dx, dz) : 6.2831853 * hh(c.id, key, 5);
  const runEnd = lying ? (Math.floor(k / 3) * 3 + 3) : k + 1;                    // first slot after this spot
  return { lying, ka, key, P0, P1, d, dx, dz, dur, hWalk, tA, runEnd };
}
/** heading of a cow `settle` seconds after it arrived (grazing round its spot drifts it a little) */
const drift = (c, p, settle) => p.hWalk + (p.lying ? 0.5 * (hh(c.id, p.key, 6) - 0.5) * smooth(0, 3, settle) : 0.45 * Math.sin(settle * 0.09 + c.seed * 6) * smooth(0, 5, settle));

/**
 * State of cow c at shared time tMs. hourAt(ms) -> game hour (default: the shared clock's).
 * out = {x, z, h, walk 0..1, graze 0..1, lie 0..1, phase (stride phase, radians), moving}
 */
export function cowState(herd, c, tMs, out = {}, hourAt = hourOf) {
  const S = c.slotMs, tt = tMs + c.offMs, k = Math.floor(tt / S);
  const p = plan(herd, c, k, hourAt), sinceA = (tMs - p.tA) / 1000;           // seconds since the arrival slot began
  let x, z, walk = 0, h, walked;
  if (p.dur > 0 && sinceA < p.dur) {
    const e = trap(sinceA / p.dur);
    x = p.P0[0] + p.dx * e; z = p.P0[1] + p.dz * e; walked = p.d * e;
    walk = Math.min(1, sinceA / 0.8, (p.dur - sinceA) / 0.8);
    h = p.hWalk;
  } else {
    x = p.P1[0]; z = p.P1[1]; walked = p.d;
    h = drift(c, p, sinceA - p.dur);
  }
  // turn from the way it faced at the end of the previous spot (a turn on the spot while it sets off)
  // (the direction of the turn is decided by the walk heading alone, so a drift of the target never flips it)
  if (sinceA < TURN) { const q = plan(herd, c, p.ka - 1, hourAt), endPrev = drift(c, q, (p.tA - q.tA) / 1000 - q.dur); h = lerpAngle(endPrev, p.hWalk, smooth(0, TURN, sinceA)) + (h - p.hWalk); }
  const phase = (walked / STRIDE) * 6.2831853;
  // lying: down after arriving, up again at the end of the run
  const tEnd = (p.runEnd * S - c.offMs - tMs) / 1000, settle = sinceA - p.dur;
  const lie = p.lying ? Math.min(smooth(0.5, 4.5, settle), smooth(1, 5, tEnd)) : 0;
  // grazing: head down while it stands, up every so often to look about and chew
  const t = tMs / 1000, up = Math.max(smooth(0.45, 0.75, Math.sin(t * 0.21 + c.seed * 17)), smooth(0.75, 0.95, Math.sin(t * 0.083 + c.seed * 5)));
  const graze = p.lying ? 0 : (1 - walk) * smooth(0, 1.5, settle) * (1 - 0.85 * up);
  out.x = x; out.z = z; out.h = h; out.walk = walk; out.graze = graze; out.lie = lie; out.phase = phase; out.moving = walk > 0.01;
  return out;
}
