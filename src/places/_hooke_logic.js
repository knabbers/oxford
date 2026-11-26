// The Robert Hooke Building on Parks Road (owned by places/hooke_building.js): pure data and the shared-clock schedule
// of the banana lecture. DOM-free and three-free, so node tests (tools/smoke_hooke.mjs) and the voice extractor can
// import it.
//
// Where: the mapped building w679676362 ("Robert Hooke Building", OSM), on the EAST side of Parks Road between the Keble
// Road junction and the University Museum (its main entrance is to the left of the Museum's when you come from Keble
// Road). Its long west face looks across Parks Road at Keble. A ground-floor classroom ("the banana room") is cut into
// that face as a bay of the footprint: tall windows onto the road, the whiteboard on the back wall facing the street.

/** the professor's one line (the user's exact words, capitalised and punctuated) and his voice id */
export const PROF_SPEAKER = 'hooke_prof';
export const PROF_LINE = 'Ah look, a banana.';
/** every line he says (read by the voice extractor: tools/voices/extract.mjs should import this module) */
export const PROF_LINES = [PROF_LINE];

// ------------------------------------------------------------------------------------------------ the façade frame
export const HOOKE = (() => {
  const id = 'w679676362';
  const A = [222.7, -453.6], B = [233.6, -423.4];           // the Parks Road face of the mapped footprint (north -> south)
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
  const n = [-u[1], u[0]];                                    // outward normal: towards Parks Road (west)
  // the classroom bay: s (metres along the face from A) S0..S1, d metres deep into the building
  const S0 = 9, S1 = 22, D = 9, Sc = (S0 + S1) / 2, W = S1 - S0;
  const GROUND = 3.9;                                         // the ground storey (the upper floors start here)
  const CEIL = 3.55;                                          // the classroom's ceiling
  const doorS = 7.5;                                          // the street door (into the lobby), north of the bay: on the centre of the mapped wall's third bay (3 m bays), whose painted sash it replaces (world/walkin_bays.js)
  return { id, A, B, L, u, n, S0, S1, D, Sc, W, GROUND, CEIL, doorS, H: 11.4 };
})();
/** world [x, z] of façade coordinates (s along the face from A, out = metres outwards; negative = inside) */
export function facadeAt(s, out = 0) { const H = HOOKE; return [H.A[0] + H.u[0] * s + H.n[0] * out, H.A[1] + H.u[1] * s + H.n[1] * out]; }
/** room-local (x along the face from the bay centre, z outwards: 0 = the façade, -D = the back wall) -> world [x, z] */
export function roomToWorld(x, z) { return facadeAt(HOOKE.Sc + x, z); }
/** world -> room-local [x, z] */
export function worldToRoom(wx, wz) { const H = HOOKE, dx = wx - H.A[0], dz = wz - H.A[1]; return [dx * H.u[0] + dz * H.u[1] - H.Sc, dx * H.n[0] + dz * H.n[1]]; }
/** rotation.y that turns room-local axes into world axes (local +x -> u, local +z -> n) */
export const ROOM_YAW = Math.atan2(-HOOKE.u[1], HOOKE.u[0]);
/** heading (game convention) that looks from the street into the room */
export const LOOK_IN = Math.atan2(-HOOKE.n[0], -HOOKE.n[1]);
/** heading pointing out of the building (doors) */
export const FACING_OUT = Math.atan2(HOOKE.n[0], HOOKE.n[1]);

/** the mapped footprint with the bay cut out of its Parks Road face (A, notch, B, the rest) */
export function notchedPoly(poly) {
  const H = HOOKE, near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.3;
  const ia = poly.findIndex((p) => near(p, H.A)), ib = poly.findIndex((p) => near(p, H.B));
  if (ia < 0 || ib < 0) return null;
  const notch = [facadeAt(H.S0, 0), facadeAt(H.S0, -H.D), facadeAt(H.S1, -H.D), facadeAt(H.S1, 0)];
  const out = [];
  const N = poly.length;
  if ((ia + 1) % N === ib) { for (let k = 0; k < N; k++) { const i = (ia + k) % N; out.push(poly[i]); if (i === ia) out.push(...notch); } }
  else if ((ib + 1) % N === ia) { for (let k = 0; k < N; k++) { const i = (ib + k) % N; out.push(poly[i]); if (i === ib) out.push(...notch.slice().reverse()); } }
  else return null;
  return out.map((p) => [+p[0].toFixed(2), +p[1].toFixed(2)]);
}
/** the bay's footprint (the upper floors stand over it on the ground storey) */
export function bayPoly() { const H = HOOKE; return [facadeAt(H.S0, 0), facadeAt(H.S1, 0), facadeAt(H.S1, -H.D), facadeAt(H.S0, -H.D)].map((p) => [+p[0].toFixed(2), +p[1].toFixed(2)]); }

// ------------------------------------------------------------------------------------------------ room layout (room-local metres)
export const ROOM = {
  board: { x: 0, y: 2.05, w: 5.4, h: 2.7, z: -HOOKE.D + 0.07 },      // whiteboard on the back wall, facing the street
  prof: { x: 3.45, z: -HOOKE.D + 1.05 },
  talk: { x: 2.85, z: -HOOKE.D + 1.95 },                               // where you stand to talk to him                                // beside the board (the street sees him on its right)
  rows: [-5.6, -4.0, -2.4],                                             // seat lines (students face the board, -z)
  cols: [-4.6, -3.3, -2.0, 0.9, 2.2, 3.5],                              // seat positions along a row (aisle round x ≈ -0.5)
  // windows in the bay's façade: [x0, x1] between stone piers; sill / head heights
  windows: [[-6.0, -3.05], [-2.45, 2.45], [3.05, 6.0]],         // the wide middle one frames the board
  sill: 0.62, head: 3.08,
};
/** who sits where: [row, col] pairs taken (a few students, deterministic) */
export const STUDENTS = [[0, 1], [0, 4], [1, 0], [1, 2], [1, 3], [1, 5], [2, 1], [2, 4]];

// ------------------------------------------------------------------------------------------------ the shared-clock schedule
export const SLOT_MS = 16000;
const hash = (k) => { let x = Math.imul((k | 0) ^ 0x6b43a9b5, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
/** the moment (shared-clock ms) of the k-th "Ah look, a banana.": one per 16 s slot, 2–6 s into it (so 12–20 s apart) */
export function lineTime(k) { return k * SLOT_MS + 2000 + Math.floor(hash(k) * 4000); }
/** the line nearest before `ms` (k, time) */
export function lastLine(ms) {
  let k = Math.floor(ms / SLOT_MS);
  if (lineTime(k) > ms) k--;
  return { k, at: lineTime(k) };
}
export function nextLine(ms) { const l = lastLine(ms); return { k: l.k + 1, at: lineTime(l.k + 1) }; }

const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const WAVE = { turn0: -1.7, turn1: -1.05, start: -1.0, end: 2.7, back0: 2.7, back1: 3.5, hz: 1.35 };
/**
 * The professor at shared-clock time ms -> { k, u, toBoard 0..1 (turned to the board), wave 0..1 (the big looping
 * wave), ph (wave phase, radians), talk 0..1 (chatting to the class), speaking (within the line) }.
 * u = seconds since the nearest line (negative before it). Pure: every client computes the same.
 */
export function profAt(ms) {
  const a = lastLine(ms), b = nextLine(ms);
  const ua = (ms - a.at) / 1000, ub = (ms - b.at) / 1000;
  const near = ub > WAVE.turn0 - 0.01 ? { k: b.k, u: ub } : { k: a.k, u: ua };
  const u = near.u, W = WAVE;
  const toBoard = sm(W.turn0, W.turn1, u) * (1 - sm(W.back0, W.back1, u));
  const wave = sm(W.start - 0.15, W.start + 0.35, u) * (1 - sm(W.end - 0.45, W.end, u));
  const ph = (u - W.start) * Math.PI * 2 * W.hz;
  const talk = 1 - toBoard;
  return { k: near.k, u, toBoard, wave, ph, talk, speaking: u >= 0 && u < 1.6 };
}

// ------------------------------------------------------------------------------------------------ sights (passport)
export const SIGHTS = (() => { const p = roomToWorld(0, 4); return [{ id: 'banana-lecture', name: 'The Banana Lecture', x: +p[0].toFixed(1), z: +p[1].toFixed(1), blurb: 'Through the ground-floor windows of the Robert Hooke Building on Parks Road, a lecture that never gets past its first slide: a banana, on a set of axes.' }]; })();
