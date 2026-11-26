// Terrain (2026-11): the real ground of Oxford, from the Environment Agency's 2022 LIDAR survey (1 m; contains public
// sector information licensed under the Open Government Licence v3.0), drawn as a RENDER WARP. The game's world stays
// flat (collision, the walk graph, traffic lanes, groundHeight(), physics, multiplayer positions: nothing changes,
// y = 0 is still the ground), and every vertex drawn outdoors is lifted in the vertex shader by
// height(x, z) - reference, where the reference is the height of the ground under the camera. Near the eye everything
// is exactly as on the flat; what changes is that the ground ahead really rises or falls away: the High climbs to
// Carfax, St Aldate's runs down to Folly Bridge, Headington Hill and South Park stand 40 m over the city.
//   - data: world/_terrain_data.js, made by tools/terrain_build.py (docs/ARCHITECTURE.md "Terrain": how it is smoothed,
//     the water / bridge / precinct rules). Decoded and sampled by world/_terrain_field.js: nodes every 2 m, each cell
//     two flat triangles; `terrainH` here and `gtoTerrain3` in the shaders read the same floats the same way.
//   - two fields: the GROUND (with bridge decks) lifts everything; the WATER's own level lifts the water and whatever
//     is marked afloat (terrainAfloat: boats, swimmers), so a river stays down under its bridge and level at its banks.
//   - shader: three's `common` chunk gets the sampler (a float texture on the last texture unit, bound once outside
//     three's bookkeeping; a wrapped gl.useProgram points each program's sampler at it and hands it the reference),
//     `project_vertex` (every built-in material, every onBeforeCompile patch that keeps the chunk) and the sprite
//     shader apply it; patched once, here, before anything compiles. ShaderMaterials with their own projection put
//     TERRAIN_VS at the top and add GTO_DH(worldXZ) (GTO_DHW for water) to their view-space position. Orthographic
//     passes (the sun's shadow map, the light-map / sky-light / grass-mask bakes, the tree-card bake) are not lifted:
//     shadows and the top-down maps are worked out in the flat world, and the lift then carries everything alike.
//   - triangles: a flat triangle lies exactly on the surface unless one of its creases crosses it; the tile batcher
//     cuts (terrainSubdivide) the triangles a crease crosses where that matters by more than a tolerance. Edge-based,
//     so neighbours are cut alike and no cracks open. Lighting normals are untouched: a crease does not show as shading.
//   - culling: Frustum.intersectsSphere tests a sphere where it is drawn (perspective frusta only).
// `?terrain=0` (node: GTO_TERRAIN=0) turns it all off; `?terrain=old` (GTO_TERRAIN=old) brings back the first hill, a
// guessed fan of planes for Headington Hill only (world/_terrain_old.js), for before / after pictures.
import * as THREE from 'three';
import { TERRAIN_DATA } from './_terrain_data.js';
import { decodeField, makeField } from './_terrain_field.js';
import { FAN } from './_terrain_old.js';

const qs = typeof location !== 'undefined' && location.search ? location.search : '';
const env = typeof process !== 'undefined' && process.env ? process.env : {};
/** the whole east / south photo pass (hills, trees, Magdalen Tower's crown, the Cowley Road fronts, 2013 names): `?eastpass=0` (node GTO_EASTPASS=0) builds the game as before it, for before / after shots from identical cameras */
export const EASTPASS = !/[?&]eastpass=0/.test(qs) && env.GTO_EASTPASS !== '0';
const MODE = !EASTPASS || /[?&]terrain=0/.test(qs) || env.GTO_TERRAIN === '0' ? 'off' : /[?&]terrain=old/.test(qs) || env.GTO_TERRAIN === 'old' ? 'old' : 'real';
const F = MODE === 'real' ? makeField(decodeField(TERRAIN_DATA)) : null;
/**
 * on / mode ('real' | 'old' | 'off'); datum: terrainH 0 = this many metres above sea level; ref: the height everything
 * is drawn relative to (set for each render from its camera, see refFor); focus: [x, z] of the player (world/index.js
 * sets it every frame), focusAfloat: the player is on / in the water there; split: triangles the cuts added, capped:
 * tile buffers that hit the cutter's ceiling; decodeMs: start-up cost of the data
 */
export const TERRAIN = { on: MODE !== 'off', mode: MODE, datum: TERRAIN_DATA.datum, H: 38, W: 650, minX: MODE === 'old' ? FAN.minX : -Infinity, cam: null, ref: 0, focus: null, focusAfloat: false, split: 0, capped: 0, diced: 0, decodeMs: F ? F.ms : 0, field: F };

/** Height of the drawn ground above the flat world at (x, z), metres above the datum (58 m above sea level). */
export const terrainH = MODE === 'real' ? F.h : MODE === 'old' ? FAN.h : () => 0;
/** The same for the water (and anything afloat): the reach's own level on and beside the water, the ground elsewhere. */
export const terrainWater = MODE === 'real' ? F.w : terrainH;
/** Slope of the ground at (x, z) as [dH/dx, dH/dz]. */
export function terrainSlope(x, z) { return [(terrainH(x + 0.5, z) - terrainH(x - 0.5, z)), (terrainH(x, z + 0.5) - terrainH(x, z - 0.5))]; }
/** Is (x, z) on the water, or over water under a deck? (where something afloat must be marked: terrainAfloat) */
export const terrainOverWater = MODE === 'real' ? (x, z) => { const r = F.sample(F.R, x, z); return F.sample(F.W, x, z) >= r - 0.02 || F.sample(F.B, x, z) < r - 0.3; } : () => false;
/** Metres above sea level of the drawn ground at (x, z) (for builders working from survey levels). */
export function terrainLevel(x, z) { return terrainH(x, z) + TERRAIN.datum; }

const f = (n) => { const s = String(+n.toFixed(6)); return /[.e]/.test(s) ? s : s + '.0'; };
/** the depth bias of the ground's layers, in metres of height by distance D: pull = near + k (D - from), at most cap, and for what is built on the ground (flat y above 3.5 cm) `road` more over roadFrom..roadTo; the base ground's set-back = push0 everywhere (a hand-built lawn cut to another lattice lies clear of it), push more over pushFrom..pushTo (where the coarser cut begins), push2 more over push2From..push2To (where the uncut ground begins), then + pushK per metre */
export const STACK = { near: 0.05, from: 30, k: 0.003, cap: 0.35, road0: 0.4, road: 2.5, roadFrom: 40, roadTo: 90, push0: 0.03, push: 0.4, pushFrom: 32, pushTo: 48, push2: 2.2, push2From: 240, push2To: 320, pushK: 0.002 };
const STACK_PULL = `min(${f(STACK.cap)}, ${f(STACK.near)} + ${f(STACK.k)} * max(0.0, gtoD - ${f(STACK.from)}))`;
// (what is BUILT on the ground - carriageways, paths, pavements, kerbs, paint, the decals on them: thin ribbons - is pulled
//  much further beyond the near ring: there the base ground is cut to 25 m, and where a road runs in a cutting or below
//  a terrace a block of it can lie a metre or more over the road. And by 0.4 m inside the ring: a street between banks
//  is a hollow, the base ground's 5 m pieces span it as chords a hand above the surface, the road's own 4 m pieces
//  a little less: Headington Road was grass from kerb to kerb)
const STACK_ROAD = `(${f(STACK.road0)} + ${f(STACK.road - STACK.road0)} * smoothstep(${f(STACK.roadFrom)}, ${f(STACK.roadTo)}, gtoD))`;
/** the define a material lying ON the ground takes (world/materials.js addDepthBias): `material.defines.GTO_STACK = TERRAIN_STACK` */
export const TERRAIN_STACK = '(' + STACK_PULL + ' + ' + STACK_ROAD + ' + 0.01)';
/** the same for a material that WRITES depth (a place's own layer on the ground): the small pull only, or what stands on it would be clipped */
export const TERRAIN_STACK_SOFT = '(' + STACK_PULL + ' + 0.01)';
const REAL = F ? `
#ifndef GTO_TERRAIN
#define GTO_TERRAIN
uniform highp sampler2D gtoMap;
uniform highp vec4 gtoRef;
uniform highp vec2 gtoTilt;
highp vec3 gtoTerrain3(highp vec2 p) {   // (.x the ground with the decks, .y the water's level, .z the bare ground)
	highp vec2 q = clamp((p - vec2(${f(F.x0)}, ${f(F.z0)})) * ${f(1 / F.g)}, vec2(0.0), vec2(${f(F.nx - 1.001)}, ${f(F.nz - 1.001)}));
	highp ivec2 i = ivec2(q); highp vec2 w = q - vec2(i);
	bool lo = w.x + w.y <= 1.0;
	highp vec3 a = texelFetch(gtoMap, i + ivec2(1, 0), 0).rgb, b = texelFetch(gtoMap, i + ivec2(0, 1), 0).rgb, c = texelFetch(gtoMap, lo ? i : i + ivec2(1, 1), 0).rgb;
	return lo ? c + w.x * (a - c) + w.y * (b - c) : c + (1.0 - w.x) * (b - c) + (1.0 - w.y) * (a - c);
}
highp float gtoStand(highp vec3 t) { return max(t.x, t.y); }
highp float gtoTerrain(highp vec2 p) { return gtoStand(gtoTerrain3(p)); }
// (gtoRef.y != 0: a pass that is not the world's - ROOM PASSES in terrainGL: every vertex stands on ONE plane, gtoRef.z + gtoTilt . xz, the field is not used)
#define GTO_LIFT(h, p) (projectionMatrix[3][3] == 0.0 ? viewMatrix[1].xyz * ((gtoRef.y != 0.0 ? gtoRef.z + dot(gtoTilt, (p)) : (h)) - gtoRef.x) : vec3(0.0))
#define GTO_DH(p) GTO_LIFT(gtoStand(gtoTerrain3(p)), p)
#define GTO_DHW(p) GTO_LIFT(gtoTerrain3(p).y, p)
#ifdef USE_LAYER_BIAS
#define GTO_DHM(p) GTO_LIFT(aLayer < 0.5 ? gtoTerrain3(p).z : gtoTerrain3(p).x, p)
#ifndef GTO_STACK
#define GTO_STACK (aLayer < 0.9 ? -(${f(STACK.push0)} + ${f(STACK.push)} * smoothstep(${f(STACK.pushFrom)}, ${f(STACK.pushTo)}, gtoD) + ${f(STACK.push2)} * smoothstep(${f(STACK.push2From)}, ${f(STACK.push2To)}, gtoD) + ${f(STACK.pushK)} * max(0.0, gtoD - ${f(STACK.push2To)})) : ${STACK_PULL} + (transformed.y > 0.035 ? ${STACK_ROAD} : 0.0))
#endif
#else
#define GTO_DHM(p) GTO_LIFT(modelMatrix[0][3] != 0.0 || modelMatrix[1][3] != 0.0 || modelMatrix[2][3] != 0.0 ? gtoTerrain3(p).y : gtoStand(gtoTerrain3(p)), p)
#endif
#endif
` : '';
// THE GROUND'S LAYERS (base ground, landuse, roads, paths and pavements, paint, contact strips, lamp pools) lie
// millimetres apart in the flat world and are told apart there by the depth buffer. Lifted corner by corner onto real
// ground, each runs straight between its own corners where the surface bends, a little off the surface and by a
// different amount for every layer: they would poke through one another unless every one were cut to the millimetre
// along every crease of the survey (measured: five times the city's triangles). So they are ordered by DRAWING instead:
//   - the BASE ground alone writes depth (and what stands under a bridge deck with it: world/_terrain_bridges.js);
//   - the layers above are drawn after it, in the order of their real heights (the tile batcher sorts each tile and
//     gives the layers ascending renderOrder), testing depth with a pull towards the eye (GTO_STACK: 5 cm of height
//     near, growing with distance to 35 cm) and NOT writing it;
//   - everything else is drawn later and stands on the base ground's depth: nothing that stands on a road can be
//     hidden by the road. Far off the base ground's own depth is set back (0.25 m from 86 m, growing), so a far
//     triangle that runs a hand high never clips feet, wheels, decals or a hand-built lawn.
// The pull moves depth only (the vertex is scaled along its own line of sight after everything else in the vertex
// shader, in three's fog_vertex chunk): nothing shifts on screen, fog and lighting see the real position.
// Triangles then need cutting only as finely as the eye wants (terrainTol), near the camera (the batcher's ring).
const STACK_VS = `
#ifdef GTO_STACK
if (projectionMatrix[3][3] == 0.0) {
	float gtoD = length(mvPosition.xyz), gtoHh = max(abs(dot(mvPosition.xyz, viewMatrix[1].xyz)), 0.05);
	float gtoS = 1.0 - clamp((GTO_STACK) / gtoHh, -0.5, 0.5);
	gl_Position.xy *= gtoS; gl_Position.w *= gtoS; gl_Position.z = projectionMatrix[3][2] - projectionMatrix[2][2] * gl_Position.w;
}
#endif
`;
const OFF = `
#ifndef GTO_TERRAIN
#define GTO_TERRAIN
#define GTO_DH(p) vec3(0.0)
#define GTO_DHW(p) vec3(0.0)
#define GTO_DHM(p) vec3(0.0)
#endif
`;
/**
 * GLSL for the top of a vertex shader with its own projection: after it, `GTO_DH(worldXZ)` is the view-space offset
 * (vec3) to add; `GTO_DHW(worldXZ)` the same for water and what floats on it; `GTO_DHM(worldXZ)` picks by whether the
 * object was marked with terrainAfloat (needs modelMatrix).
 */
export const TERRAIN_VS = MODE === 'real' ? REAL : MODE === 'old' ? FAN.glsl : OFF;

// ---------------------------------------------------------------------------------------------- afloat
const UM = THREE.Object3D.prototype.updateMatrix;
function afloatMatrix() { UM.call(this); this.matrix.elements[7] = 1e-30; }
/**
 * Mark an object (and so everything under it) as riding on the WATER's level rather than the ground's: boats, a
 * swimmer, waterfowl. The mark is a number far too small to move anything, in a cell of the object's matrix that is
 * otherwise zero; the shaders read it there, so no material is cloned and no draw call changes.
 */
export function terrainAfloat(obj, on = true) {
  if (!obj || MODE !== 'real') return obj;
  if (on) { obj.updateMatrix = afloatMatrix; obj.matrix.elements[7] = 1e-30; } else { delete obj.updateMatrix; obj.matrix.elements[7] = 0; }
  obj.matrixWorldNeedsUpdate = true;
  return obj;
}

// ---------------------------------------------------------------------------------------------- the card
const glState = new WeakMap();
/**
 * The reference for a camera. A camera that follows the player (within 12 m of TERRAIN.focus) takes the ground under
 * the PLAYER, so the player is drawn exactly where the flat game has them whatever the camera hangs over (the water
 * beside a bridge, the foot of a bank); a camera on its own (30 m and more away: a fixed view, a room's window) takes
 * the ground under itself; between the two, a blend.
 */
let passLift = null, still = false;      // (ROOM PASSES in terrainGL: [lift, per x, per z] of the pass being drawn, null in a pass of the world; a picture being taken)
/**
 * The plane a walk-in room stands on, in WORLD x, z: [A, Bx, Bz], height above the datum = A + Bx X + Bz Z.
 * `room` = what core/interiors.js gives a room (`sl.terrain`): { toWorld(x, z, out), doors() -> [[x, z, X, Z], ...] its
 * doorways to the world (room x, z; world X, Z; the main door first), root: the room it is entered from, if any }.
 * One door: level, the surveyed ground at that door. Several: the plane that best meets the ground at every door, if it
 * tilts no more than ROOM_TILT (the Covered Market's avenues do fall 1.2 m from Market Street to the High); otherwise
 * level at the main door, and the other doors meet their pavements with a step (`room.steps`, metres, for a list).
 * A room entered from another stands on that room's plane.
 */
const ROOM_TILT = 0.02;
/**
 * What the shader lifts a vertex of `object` by, as a function (x, z, layer) -> metres above the datum: the base ground
 * (a mesh drawn with the layered ground material, layer under 0.5) rides on the bare ground, its other layers on the
 * ground with the bridge decks, water and anything afloat on the water's level, everything else on the higher of
 * ground and water. For whoever must undo or reproduce the lift exactly (world.terrainLevelObject; tools/_lifted.mjs
 * has the same rule for tools).
 */
export function terrainLiftOf(object) {
  if (MODE !== 'real') return terrainH;
  const m = Array.isArray(object.material) ? object.material[0] : object.material, e = object.matrixWorld.elements;
  if ((m && typeof m.vertexShader === 'string' && m.vertexShader.includes('GTO_DHW(w.xz)')) || e[3] !== 0 || e[7] !== 0 || e[11] !== 0) return terrainWater;
  if (m && m.defines && m.defines.USE_LAYER_BIAS !== undefined && object.geometry && object.geometry.attributes.aLayer) return (x, z, lay) => (lay < 0.5 ? F.sample(F.B, x, z) : F.sample(F.R, x, z));
  return terrainH;
}
export function terrainRoomPlane(room) {
  let root = room; for (let k = 0; root && root.root && k < 8; k++) root = root.root;
  if (!root || MODE !== 'real') return null;
  if (root._plane !== undefined) return root._plane;
  const D = root.doors ? root.doors() : []; if (!D.length) return (root._plane = null);
  const x0 = D[0][2], z0 = D[0][3], h = D.map((d) => terrainH(d[2], d[3]));
  let a = h[0], bx = 0, bz = 0;
  if (D.length > 1) {
    // least squares about the main door, with a little stiffness (two doors: the fall along the line between them)
    let sxx = 1e-3, sxz = 0, szz = 1e-3, sx = 0, sz = 0, sh = 0, sxh = 0, szh = 0; const n = D.length;
    for (let k = 0; k < n; k++) { const x = D[k][2] - x0, z = D[k][3] - z0; sxx += x * x; sxz += x * z; szz += z * z; sx += x; sz += z; sh += h[k]; sxh += x * h[k]; szh += z * h[k]; }
    // [n sx sz; sx sxx sxz; sz sxz szz] [a bx bz] = [sh sxh szh]
    const det = n * (sxx * szz - sxz * sxz) - sx * (sx * szz - sxz * sz) + sz * (sx * sxz - sxx * sz);
    if (Math.abs(det) > 1e-9) {
      const a1 = (sh * (sxx * szz - sxz * sxz) - sx * (sxh * szz - sxz * szh) + sz * (sxh * sxz - sxx * szh)) / det;
      const b1 = (n * (sxh * szz - sxz * szh) - sh * (sx * szz - sxz * sz) + sz * (sx * szh - sxh * sz)) / det;
      const c1 = (n * (sxx * szh - sxh * sxz) - sx * (sx * szh - sxh * sz) + sh * (sx * sxz - sxx * sz)) / det;
      if (Math.hypot(b1, c1) <= ROOM_TILT) { a = a1; bx = b1; bz = c1; }
    }
  }
  const P = (root._plane = [a - bx * x0 - bz * z0, bx, bz]);
  root.steps = D.map((d, k) => +(h[k] - (P[0] + P[1] * d[2] + P[2] * d[3])).toFixed(3));
  return P;
}
/** the height (above the datum) a walk-in room's plane has at world (X, Z); null if `room` has none */
export function terrainRoomLevel(room, X, Z) { const P = room ? terrainRoomPlane(room) : null; return P ? P[0] + P[1] * X + P[2] * Z : null; }
// the same plane in the room's own x, z: [a, bx, bz]
function roomLocal(room) {
  if (room._loc !== undefined) return room._loc;
  const P = terrainRoomPlane(room); if (!P) return (room._loc = null);
  const at = (x, z) => { const w = room.toWorld(x, z, [0, 0]); return P[0] + P[1] * w[0] + P[2] * w[1]; }, a = at(0, 0);
  return (room._loc = [a, at(1, 0) - a, at(0, 1) - a]);
}
/** a room's picture is being taken in its own frame (core/_roomview.js): the passes until terrainStill(false) are not lifted */
export function terrainStill(on) { still = !!on; }
function refFor(camera) { const e = camera.matrixWorld.elements; return refAt(e[12], e[14]); }
function refAt(cx, cz) {
  const fo = TERRAIN.focus;
  let r = terrainH(cx, cz);
  if (fo) {
    const d = Math.hypot(cx - fo[0], cz - fo[1]);
    if (d < 30) { const fl = TERRAIN.focusLevel, hf = fl !== null && fl !== undefined ? fl : TERRAIN.focusAfloat ? terrainWater(fo[0], fo[1]) : terrainH(fo[0], fo[1]), k = d <= 12 ? 0 : (d - 12) / 18; r = hf + (r - hf) * k * k * (3 - 2 * k); }
  }
  return r;
}
/**
 * Give a renderer the height texture (once per renderer; safe to call again, and after a restored context). Nothing of
 * three's is touched: the texture sits on the last combined texture unit, which three never allocates, and
 * gl.useProgram is wrapped to point `gtoMap` at it and keep `gtoRef` current. renderer.render is wrapped to set the
 * reference from each render's camera.
 */
export function terrainGL(renderer) {
  if (MODE !== 'real' || !renderer || !renderer.getContext || glState.has(renderer)) return;
  const gl = renderer.getContext(); if (!gl || !gl.texImage2D) return;
  const S = { unit: 0, tex: null, cur: null, ver: 1, ref: 0, one: 0, lvl: 0, tx: 0, tz: 0, progs: new WeakMap() };
  glState.set(renderer, S);
  const upload = () => {
    // THE UNIT. Not the last one: three keeps that for itself - every texture it binds without naming a unit goes to
    // MAX_COMBINED - 1 (WebGLState.bindTexture / activeTexture), so a texture bound there behind three's back is
    // replaced the next time three sets one up, and the field then reads as whatever that was: on the high tier the
    // whole world was drawn without its heights, sunk by the reference. The last but one is nobody's: three hands out
    // units from 0 for a material's own textures and stops at the fragment stage's limit (16), far below.
    S.unit = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) - 2;
    const px = new Float32Array(F.nx * F.nz * 3);
    for (let k = 0, n = F.nx * F.nz; k < n; k++) { px[k * 3] = F.R[k]; px[k * 3 + 1] = F.W[k]; px[k * 3 + 2] = F.B[k]; }
    const act = gl.getParameter(gl.ACTIVE_TEXTURE), flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), pre = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), al = gl.getParameter(gl.UNPACK_ALIGNMENT);
    S.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + S.unit); gl.bindTexture(gl.TEXTURE_2D, S.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, F.nx, F.nz, 0, gl.RGB, gl.FLOAT, px);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pre); gl.pixelStorei(gl.UNPACK_ALIGNMENT, al);
    gl.activeTexture(act);
    S.progs = new WeakMap(); S.cur = null; S.ver++;
  };
  upload();
  // (and it is bound again before every pass, through three's own switch of the active unit so that three's book of
  //  what is active stays true: cheap - three calls at most - and nothing that resets the GL state can leave the
  //  field unbound for a frame)
  const st = renderer.state;
  const bind = () => { if (!S.tex) return; if (st && st.activeTexture) { st.activeTexture(gl.TEXTURE0 + S.unit); gl.bindTexture(gl.TEXTURE_2D, S.tex); st.activeTexture(gl.TEXTURE0); } else { gl.activeTexture(gl.TEXTURE0 + S.unit); gl.bindTexture(gl.TEXTURE_2D, S.tex); gl.activeTexture(gl.TEXTURE0); } };
  const use = gl.useProgram.bind(gl);
  const feed = (p) => {
    let rec = S.progs.get(p);
    if (!rec) { rec = { ref: gl.getUniformLocation(p, 'gtoRef'), tilt: gl.getUniformLocation(p, 'gtoTilt'), ver: 0 }; S.progs.set(p, rec); const m = gl.getUniformLocation(p, 'gtoMap'); if (m) gl.uniform1i(m, S.unit); }
    if (rec.ref && rec.ver !== S.ver) { gl.uniform4f(rec.ref, S.ref, S.one, S.lvl, 0); if (rec.tilt) gl.uniform2f(rec.tilt, S.tx, S.tz); rec.ver = S.ver; }
  };
  gl.useProgram = (p) => { use(p); S.cur = p || null; if (p) feed(p); };
  const render = renderer.render;
  // ROOM PASSES. The field belongs to the WORLD scene's coordinates. Anything else that is drawn - a walk-in room in its
  // own coordinates with its own camera (core/interiors.js), a room the game has gone into altogether, a preview - has
  // no business with it: lifted by the field at ITS coordinates a room took the relief of whatever lies near the map's
  // origin. So: a scene that is not the world's is drawn with NO lift; except a LIVE pass of a walk-in room, which is
  // one body standing on ONE plane (terrainRoomPlane below; `scene.userData.terrainRoom`, set by core/interiors.js):
  // every vertex is lifted by (the plane there - the reference of the world camera this pass's camera stands for), so
  // the room meets the world drawn through its openings: floors true, walls plumb, the threshold on the pavement.
  // `terrainStill(true)`: a picture being taken of a room in its own frame (the impostors in its windows): no lift.
  const _rw = [0, 0];
  renderer.render = function (scene, camera) {
    let lift = null;
    if (camera && camera.isPerspectiveCamera) {
      if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
      let r, one = 0, lvl = 0, tx = 0, tz = 0;
      if (!TERRAIN.scene || scene === TERRAIN.scene) r = refFor(camera);
      else {
        const room = !still && scene && scene.userData ? scene.userData.terrainRoom : null, Q = room ? roomLocal(room) : null;
        one = 1; r = 0;
        if (Q) { const e = camera.matrixWorld.elements, w = room.toWorld(e[12], e[14], _rw); r = refAt(w[0], w[1]); lvl = Q[0]; tx = Q[1]; tz = Q[2]; }
        lift = [lvl - r, tx, tz];
      }
      if (r !== S.ref || one !== S.one || lvl !== S.lvl || tx !== S.tx || tz !== S.tz) { S.ref = r; S.one = one; S.lvl = lvl; S.tx = tx; S.tz = tz; S.ver++; if (S.cur) feed(S.cur); }
      if (!one) TERRAIN.ref = r;
    }
    bind();
    const was = passLift; passLift = lift;
    try { return render.call(this, scene, camera); } finally { passLift = was; }
  };
  const cv = renderer.domElement;
  if (cv && cv.addEventListener) cv.addEventListener('webglcontextrestored', () => { try { upload(); } catch (e) { /* the next restore will try again */ } });
  TERRAIN.gl = S;
}

// ---------------------------------------------------------------------------------------------- buildings stand level
// The warp lifts every vertex by the ground under THAT vertex, which shears a building along its street: sills and
// eaves slope with the hill. A real house on a slope stands level and its plinth takes up the difference. So a
// building's vertices (tile batcher, layers with `anchor: true`) carry the level the building stands at, and the
// difference between that and the ground under the vertex is baked into its y — fully above 1 m, not at all at the
// foot (below 0.15 m), so the base of every wall still meets the pavement exactly: no gap, nothing buried, the bottom
// metre of wall stretches or shortens like a plinth. Only buildings whose footprint spans 0.3 m of ground or more.
const FOOT = 0.12;
const stand = (y) => { const t = y <= 0.15 ? 0 : y >= 1 ? 1 : (y - 0.15) / 0.85; return t * t * (3 - 2 * t); };
/** Bake the levels into positions (flat xyz array; `top`: the eave heights that go with them; anc: per-vertex levels or one level). */
export function terrainRigid(pos, top, anc) {
  if (MODE !== 'real') return 0;
  const one = typeof anc === 'number';
  let n = 0;
  for (let i = 0, k = 0; k < pos.length; i++, k += 3) {
    // (every wall's foot goes FOOT into the ground: between two corners the ground may stand a few cm off the straight
    //  line the wall's base runs in, and walls are not cut to it)
    const A = one ? anc : anc[i]; if (A !== A) { if (pos[k + 1] > -0.005 && pos[k + 1] < 0.005) pos[k + 1] = -FOOT; continue; }
    const d = A - terrainH(pos[k], pos[k + 2]), y = pos[k + 1];
    pos[k + 1] = y > -0.005 && y < 0.005 ? -FOOT : y + d * stand(y);
    if (top && top[i] < 1e3) top[i] += d;
    n++;
  }
  return n;
}
/**
 * What is FIXED TO THE WALL of a building that stands level (a sign board, a street-name plate, a plaque, a wall lamp)
 * and is built in a mesh of its own: add this to its y. `A` = the building's level (batch.anchors' value, or a
 * building record's `stand`; undefined / NaN = the building follows the ground: 0). The wall's own vertices above
 * 1 m carry the same offset (terrainRigid), so the thing keeps its place on the wall; without it, it stays with the
 * ground under it while the wall's bands and sills move - on a steep site by metres.
 */
export function terrainStandY(A, x, z, y) { return MODE === 'real' && A !== undefined && A === A ? (A - terrainH(x, z)) * (y === undefined ? 1 : stand(y)) : 0; }      // (y: its height on the wall - under 1 m the wall is stretched down to the ground and what is fixed there moves that much less)
/**
 * The level every sloping building stands at, by its map centre (the key the emitters fetch their tile buffer with):
 * its lowest corner plus half the fall across it, at most 1 m (a long block on a hill is cut into it, as they are);
 * none for a LONG building on a gentle fall of over 2 m (under 4 % along its length).
 * `skip`: building ids left to shear (walk-in rooms are built to the ground as drawn).
 */
const LEVEL_MAX_FALL = 2, LEVEL_GENTLE = 0.04;
export function terrainAnchors(batch, buildings, skip) {
  if (MODE !== 'real' || !batch) return 0;
  const M = new Map();
  for (const b of buildings) {
    if (!b.poly || b.poly.length < 3 || !b.c || (skip && skip[b.id])) continue;
    let lo = 1e9, hi = -1e9, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of b.poly) { const h = terrainH(p[0], p[1]); if (h < lo) lo = h; if (h > hi) hi = h; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    if (hi - lo < 0.3) continue;
    // (over 2 m of fall across a LONG building - a shopping centre, the station, a museum's whole range - and it is
    //  not levelled: one level would bury its high end by the fall less a metre. It follows the ground, and at under
    //  4 % along its length the lean that gives its floors cannot be seen. A SHORT building on such a fall - a house
    //  on a bank, 3 m in 20 - still stands level, cut into the slope: following it would lean every sill by 15 %,
    //  and what is fixed to its front would shear across it (tools/smoke_plaques.mjs found three plates behind
    //  sheared shelves). 52 of the city's buildings follow; 104 steep ones stand level, dug in at the upper end)
    if (hi - lo > LEVEL_MAX_FALL && (hi - lo) / Math.max(Math.hypot(x1 - x0, z1 - z0), 1) < LEVEL_GENTLE) continue;
    M.set(b.c[0] + ',' + b.c[1], lo + Math.min((hi - lo) / 2, 1));
  }
  batch.anchors = M;
  return M.size;
}

// How far (m) a layer's flat triangles may run off the surface between their corners before they are cut: for the eye
// (the ground's layers are ordered by drawing, see STACK above). `near.*`: inside the batcher's ring. The fan's old values in 'old'.
// GTO_TTOL / ?ttol= "ground=0.05,groundNear=0.02" overrides, for measuring.
const TOL = MODE === 'old'
  ? { water: 0, facade: 0.03, crenel: 0.03, fence: 0.012, '*': 0.004 }
  : { aoStrip: 0, water: 0, fence: 0.3, facade: 0, crenel: 0, '*': 0.05 };      // (the ground's own layers: world/_terrain_lod.js; contact strips run with the walls they lie along)
for (const kv of String((/[?&]ttol=([^&]*)/.exec(qs) || [])[1] || env.GTO_TTOL || '').split(',')) { const [k, v] = kv.split('='); if (k && isFinite(+v)) TOL[k] = +v; }
export function terrainTol(layer) { return TOL[layer] !== undefined ? TOL[layer] : TOL['*']; }
/** the lattice (m; 0 = leave it) a tolerance asks for: what a flat chord of that length typically runs off the surveyed ground (measured: 8 m 1 cm, 16 m 4 cm, 32 m 12 cm; nine in ten within 8 / 25 / 60 cm) */
export function gridOfTol(tol) { return !tol || tol >= 1 ? 0 : tol >= 0.3 ? 16 : tol >= 0.1 ? 8 : tol >= 0.02 ? 4 : 2; }
TERRAIN.tol = TOL;

let patched = false;
/** Patch three's shared chunks (once, before any material compiles) and the frustum test. */
export function installTerrain() {
  if (patched) return; patched = true;
  const C = THREE.ShaderChunk;
  if (!C.common.includes('GTO_TERRAIN')) C.common = TERRAIN_VS + C.common;
  if (!TERRAIN.on) return;
  const pv = C.project_vertex, tail = 'mvPosition = modelViewMatrix * mvPosition;';
  if (pv.includes(tail) && !pv.includes('GTO_DH')) C.project_vertex = pv.replace(tail,
    // (a FIGURE - a skinned mesh: people, core/characters.js - is lifted by the ground under its ORIGIN, the point its
    //  walking height is worked out for, and so stands whole. Lifted vertex by vertex, as everything static is, a body
    //  on a step of the ground - 2.8 m in one 2 m cell where a precinct ends at a wall - was skewed by half a metre)
    '#ifdef USE_SKINNING\nvec2 gtoXZ = modelMatrix[3].xz;\n#else\nvec2 gtoXZ = (modelMatrix * mvPosition).xz;\n#endif\n' + tail + '\nmvPosition.xyz += GTO_DHM(gtoXZ);');
  if (MODE === 'real' && !C.fog_vertex.includes('GTO_STACK')) C.fog_vertex = C.fog_vertex + STACK_VS;
  const S = THREE.ShaderLib.sprite, sl = 'vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );';
  if (S && S.vertexShader.includes(sl)) S.vertexShader = S.vertexShader.replace(sl, sl + '\n\tmvPosition.xyz += GTO_DHM(modelMatrix[3].xz);');
  // culling: a thing is drawn terrainH(its spot) - reference above where the flat world has it. Perspective frusta
  // (the eye's) test the sphere there, grown by the range of the ground across it; orthographic ones (the sun's
  // shadow box, whose pass is not lifted) are told by their parallel side planes and test the flat place.
  const P = THREE.Frustum.prototype, orig = P.intersectsSphere;
  const RX = [1, 0.707, 0, -0.707, -1, -0.707, 0, 0.707], RZ = [0, 0.707, 1, 0.707, 0, -0.707, -1, -0.707];
  const old = MODE === 'old';
  P.intersectsSphere = function (sphere) {
    // (a pass that is not the world's: everything in it stands at one height, or is not lifted at all)
    if (passLift !== null) {
      const c = sphere.center, up = passLift[0] + passLift[1] * c.x + passLift[2] * c.z;
      if (up === 0) return orig.call(this, sphere);
      const r = sphere.radius + (Math.abs(passLift[1]) + Math.abs(passLift[2])) * sphere.radius, pl = this.planes;
      for (let i = 0; i < 6; i++) { const n = pl[i].normal; if (n.x * c.x + n.y * (c.y + up) + n.z * c.z + pl[i].constant < -r) return false; }
      return true;
    }
    const cam = TERRAIN.cam, c = sphere.center;
    if (!cam || (old && cam.x < TERRAIN.minX && c.x + sphere.radius < TERRAIN.minX)) return orig.call(this, sphere);
    const a = this.planes[0].normal, b = this.planes[1].normal;
    if (a.x * b.x + a.y * b.y + a.z * b.z < -0.9999) return orig.call(this, sphere);
    // the lift is vertical, so only the frustum's top and bottom planes need the slack of the heights across the sphere
    const r = sphere.radius;
    let lo = 0, hi = 0, hc;
    if (old) {
      hc = terrainH(cam.x, cam.z);
      if (c.x + r >= TERRAIN.minX) {
        lo = hi = terrainH(c.x, c.z);
        for (let k = 0; k < 8; k++) { const h = terrainH(c.x + RX[k] * r, c.z + RZ[k] * r); if (h < lo) lo = h; else if (h > hi) hi = h; }
      }
      if (lo === hi && lo === hc) return orig.call(this, sphere);
    } else {
      hc = refAt(cam.x, cam.z);        // (the eye's own reference, worked out here: a test may cull with no frame drawn)
      if (r <= 6) {
        // (small things: the ground at the middle and round the rim; between them it cannot leave by more than the slope cap lets it)
        lo = hi = terrainH(c.x, c.z);
        for (let k = 0; k < 8; k += 2) { const h = terrainH(c.x + RX[k] * r, c.z + RZ[k] * r); if (h < lo) lo = h; else if (h > hi) hi = h; }
        lo -= r * 0.3; hi += r * 0.3;
      } else { const m = F.minMax(c.x, c.z, r); lo = m[0]; hi = m[1]; }
    }
    const mid = (lo + hi) / 2 - hc, half = (hi - lo) / 2 + 0.05, pl = this.planes;
    for (let i = 0; i < 6; i++) { const n = pl[i].normal; if (n.x * c.x + n.y * (c.y + mid) + n.z * c.z + pl[i].constant < -(r + Math.abs(n.y) * half)) return false; }
    return true;
  };
}

/**
 * Cut the triangles of a GeoBuf (world/util.js) where a crease of the ground crosses them and they would otherwise be
 * more than `tol` metres off its surface there. Edge-based (whether and where an edge is cut depends on its two ends
 * only), so shared edges stay shared. Triangle indices only: the dynamic street-front quads (buf.dyn) are left alone.
 * `water`: against the water's field (the water layer).
 */
export function terrainSubdivide(b, tol0 = 0.004, water = false, opt = null) {
  if (!TERRAIN.on || !b.idx.length) return 0;
  // opt.tolOf(first vertex of a triangle, its offset in idx) -> its own tolerance (0 = leave it); opt.src: filled with,
  // for every triangle that comes out, the number of the triangle it came from (the tile batcher's cells); opt.made:
  // filled with five numbers per new vertex, in order: (a, c, -1, t, 0) = a + (c - a) t, or (a, b, c, wa, wb) = a
  // blend of three (terrainDrape carries a geometry's other attributes along with these)
  let tol = tol0, maxE = 0, dice = 0; const tolOf = opt && opt.tolOf, srcOut = opt ? opt.src || (opt.gridOf || opt.tolOf ? [] : null) : null, maxOf = opt && opt.maxOf, diceOf = opt && opt.diceOf, diceHas = opt && opt.diceHas, made = opt && opt.made, gridOf = opt && opt.gridOf, zeroOf = opt && opt.zeroOf;
  const P = b.pos, I = b.idx, real = MODE === 'real';
  if (!real) { let any = false; for (let i = 0; i < P.length; i += 3) if (P[i] > TERRAIN.minX) { any = true; break; } if (!any) return 0; }
  // which field a vertex rides on: the water's, the bare ground's (the base layer of the ground mesh) or the ground's
  const LY = real && !water && b.lay ? b.lay : null, ANC = real && b.anc ? b.anc : null;
  const fieldOf = (i) => (water ? F.W : LY && LY[i] < 0.5 ? F.B : F.R);
  const hcache = [];
  const hv = real
    ? (i) => { let h = hcache[i]; if (h === undefined) hcache[i] = h = F.sample(fieldOf(i), P[i * 3], P[i * 3 + 2]); return h; }
    : (i) => { let h = hcache[i]; if (h === undefined) hcache[i] = h = FAN.h(P[i * 3], P[i * 3 + 2]); return h; };
  // a ceiling on what one buffer may gain (a guard, not a budget: the data is made so that it is never reached)
  const cap = Math.max(6000, I.length), over = () => added > cap;
  // where to cut edge a-c (0 = nowhere)
  const cutAt = real
    ? () => 0        // (the real field: the lattice below does the cutting; this pass only matches corners, see `dice`)
    : (a, c) => { const ax = P[a * 3], az = P[a * 3 + 2]; return FAN.cutAt(ax, az, P[c * 3] - ax, P[c * 3 + 2] - az, hv(a), hv(c), tol); };
  const mids = new Map(), M = 4194304;
  const lerp = (A_, n, a, c, t) => { if (!A_) return; for (let k = 0; k < n; k++) A_.push(A_[a * n + k] + (A_[c * n + k] - A_[a * n + k]) * t); };
  const copy = (A_, n, a) => { if (!A_) return; for (let k = 0; k < n; k++) A_.push(A_[a * n + k]); };
  // -1 = keep the edge, otherwise the index of the vertex that cuts it
  const edge = (a, c) => {
    if (a > c) { const s = a; a = c; c = s; }
    const key = a * M + c; let m = mids.get(key); if (m !== undefined) return m;
    // (a building that stands level — terrainRigid — follows the ground only at its foot: only edges down there are cut)
    if (ANC && ((ANC[a] === ANC[a] && P[a * 3 + 1] >= 1) || (ANC[c] === ANC[c] && P[c * 3 + 1] >= 1))) { mids.set(key, -1); return -1; }
    let t = over() ? 0 : cutAt(a, c);
    if (!t && (maxE || dice) && !over()) {
      // an edge the ground does not bend: still halved if it is longer than the layer allows (a triangle belongs to one
      // 64 m cell), and an axis-aligned edge of the base ground gets a corner wherever, on the `dice` m lattice, a
      // neighbouring block has one (blocks of different sizes meet there: their sides must break at the same places,
      // or the ground opens between them)
      const dx = P[c * 3] - P[a * 3], dz = P[c * 3 + 2] - P[a * 3 + 2], L2 = dx * dx + dz * dz;
      if (dice && L2 > (dice + 1) * (dice + 1) && (Math.abs(dx) < 0.05 || Math.abs(dz) < 0.05)) {
        // (the lattice point nearest the middle at which some block has a corner)
        const along = Math.abs(dx) > Math.abs(dz), p0 = along ? P[a * 3] : P[a * 3 + 2], len = along ? dx : dz, q0 = along ? P[a * 3 + 2] : P[a * 3];
        const k0 = Math.ceil((Math.min(p0, p0 + len) + 1) / dice), k1 = Math.floor((Math.max(p0, p0 + len) - 1) / dice), mid = p0 + len / 2;
        let bd = 1e9;
        for (let k = k0; k <= k1; k++) { const m = k * dice; if (Math.abs(m - mid) < bd && diceHas(along ? m : q0, along ? q0 : m)) { bd = Math.abs(m - mid); t = (m - p0) / len; } }
      }
      if (!t && maxE && L2 > maxE * maxE) t = 0.5;
      if (t) TERRAIN.diced++;
    }
    if (!t) { mids.set(key, -1); return -1; }
    lerp(b.pos, 3, a, c, t); lerp(b.nor, 3, a, c, t); lerp(b.uv, 2, a, c, t);
    copy(b.cell, 4, a); lerp(b.tint, 3, a, c, t); lerp(b.col, 3, a, c, t); lerp(b.edge, 1, a, c, t); lerp(b.top, 1, a, c, t); copy(b.det, 1, a); copy(b.lay, 1, a); copy(b.anc, 1, a);
    if (made) made.push(a, c, -1, t, 0);
    m = b.n++; mids.set(key, m); return m;
  };
  // a vertex inside triangle a-b-c at weights (w1, w2, 1 - w1 - w2), standing at the node (x, z)
  const bary = (A_, n, a, bb, c, w1, w2) => { if (!A_) return; const w3 = 1 - w1 - w2; for (let k = 0; k < n; k++) A_.push(A_[a * n + k] * w1 + A_[bb * n + k] * w2 + A_[c * n + k] * w3); };
  const centre = (a, bb, c, hit) => {
    const w1 = hit[2], w2 = hit[3];
    bary(b.pos, 3, a, bb, c, w1, w2); b.pos[b.n * 3] = hit[0]; b.pos[b.n * 3 + 2] = hit[1];
    bary(b.nor, 3, a, bb, c, w1, w2); bary(b.uv, 2, a, bb, c, w1, w2);
    copy(b.cell, 4, a); bary(b.tint, 3, a, bb, c, w1, w2); bary(b.col, 3, a, bb, c, w1, w2); bary(b.edge, 1, a, bb, c, w1, w2); bary(b.top, 1, a, bb, c, w1, w2); copy(b.det, 1, a); copy(b.lay, 1, a); copy(b.anc, 1, a);
    if (made) made.push(a, bb, c, w1, w2);
    return b.n++;
  };
  const out = [], st = [], hit = [0, 0, 0, 0];
  let added = 0;
  for (let t = 0; t < I.length; t += 3) {
    const i0 = I[t], i1 = I[t + 1], i2 = I[t + 2], n0 = out.length;
    const x0 = P[i0 * 3], x1 = P[i1 * 3], x2 = P[i2 * 3];
    if (tolOf) { tol = tolOf(i0, t); if (!tol) { out.push(i0, i1, i2); if (srcOut) srcOut.push(t / 3); continue; } }
    if (maxOf) maxE = maxOf(i0); if (diceOf) dice = diceOf(i0);
    if (real) {
    } else if (x0 < TERRAIN.minX && x1 < TERRAIN.minX && x2 < TERRAIN.minX) { out.push(i0, i1, i2); if (srcOut) srcOut.push(t / 3); continue; }
    st.push(i0, i1, i2);
    while (st.length) {
      const c = st.pop(), bb = st.pop(), a = st.pop();
      if (a === bb || bb === c || a === c) continue;       // (a sliver whose cut took its own third corner: nothing left of it)
      const mab = edge(a, bb), mbc = edge(bb, c), mca = edge(c, a);
      if (opt && opt.trace) opt.trace(a, bb, c, mab, mbc, mca);
      const n = (mab >= 0) + (mbc >= 0) + (mca >= 0);
      if (!n) {
        out.push(a, bb, c); continue;
      }
      added += n;
      if (n === 3) st.push(a, mab, mca, mab, bb, mbc, mca, mbc, c, mab, mbc, mca);
      else if (n === 1) {
        if (mab >= 0) st.push(a, mab, c, mab, bb, c);
        else if (mbc >= 0) st.push(a, bb, mbc, a, mbc, c);
        else st.push(a, bb, mca, mca, bb, c);
      } else if (mab < 0) st.push(mca, mbc, c, a, bb, mbc, a, mbc, mca);
      else if (mbc < 0) st.push(a, mab, mca, mab, bb, c, mab, c, mca);
      else st.push(mab, bb, mbc, a, mab, mbc, a, mbc, c);
    }
    if (srcOut) for (let k = n0; k < out.length; k += 3) srcOut.push(t / 3);
  }
  if (over()) TERRAIN.capped++;
  // ---- the real field: every triangle cut along the lines of a square lattice of its tolerance's size (and, at the
  // finest, the field's own diagonals: then it lies on the surface exactly). Plain clipping: a triangle a line crosses
  // becomes two or three; the corner made where an edge meets a line depends only on that edge and that line, so the
  // triangles on both sides of an edge get the same corners. It always ends, and what it costs is known beforehand:
  // the area over the square of the spacing.
  if (real) {
    const src0 = srcOut ? srcOut.slice() : null, in0 = out.slice(); out.length = 0; if (srcOut) srcOut.length = 0;
    const cuts = new Map(), q = [0, 0, 0], sd = [0, 0, 0], tri = [];
    const corner = (a, c, f, k, L) => {
      if (a > c) { const w = a; a = c; c = w; }
      const key = a + ':' + c + ':' + f + ':' + k; let m = cuts.get(key); if (m !== undefined) return m;
      const qa = f === 0 ? P[a * 3] : f === 1 ? P[a * 3 + 2] : P[a * 3] + P[a * 3 + 2], qc = f === 0 ? P[c * 3] : f === 1 ? P[c * 3 + 2] : P[c * 3] + P[c * 3 + 2], t = (L - qa) / (qc - qa);
      lerp(b.pos, 3, a, c, t); lerp(b.nor, 3, a, c, t); lerp(b.uv, 2, a, c, t);
      copy(b.cell, 4, a); lerp(b.tint, 3, a, c, t); lerp(b.col, 3, a, c, t); lerp(b.edge, 1, a, c, t); lerp(b.top, 1, a, c, t); copy(b.det, 1, a); copy(b.lay, 1, a); copy(b.anc, 1, a);
      if (made) made.push(a, c, -1, t, 0);
      m = b.n++; cuts.set(key, m); added++; return m;
    };
    // a corner inside triangle (A, B, C) where two lattice lines cross
    const nodes = new Map();
    const node = (A, B, C, x, z, tag) => {
      let m = nodes.get(tag); if (m !== undefined) return m;
      const x1 = P[A * 3], z1 = P[A * 3 + 2], x2 = P[B * 3], z2 = P[B * 3 + 2], x3 = P[C * 3], z3 = P[C * 3 + 2], den = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      const w1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / den, w2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / den;
      hit[0] = x; hit[1] = z; hit[2] = w1; hit[3] = w2;
      m = centre(A, B, C, hit); nodes.set(tag, m); added++; return m;
    };
    // polygon corners as [vertex, carrier of the side that leaves it]: carrier 0..2 = a side of the triangle, else 10 + family * 1e6 + (k + 5e5) = a lattice line
    let poly = [], next = [];
    for (let s0 = 0; s0 < in0.length; s0 += 3) {
      const source = src0 ? src0[s0 / 3] : 0, i0 = in0[s0], i1 = in0[s0 + 1], i2 = in0[s0 + 2];
      const S = gridOf ? gridOf(i0, source * 3) : gridOfTol(tolOf ? tolOf(i0, source * 3) : tol0);
      const x1 = P[i0 * 3], z1 = P[i0 * 3 + 2], x2 = P[i1 * 3], z2 = P[i1 * 3 + 2], x3 = P[i2 * 3], z3 = P[i2 * 3 + 2];
      const flat = Math.abs((x2 - x1) * (z3 - z1) - (x3 - x1) * (z2 - z1)) < 1e-4;       // (a wall: no area seen from above: cut along its length only)
      if (!S || (ANC && ANC[i0] === ANC[i0])) { out.push(i0, i1, i2); if (srcOut) srcOut.push(source); continue; }
      // (lattice lines half a spacing off the round numbers, so that they do not run along the edges of things built on round numbers; opt.zeroOf: on them, for the base ground's 25 m blocks, which a 5 m or 25 m lattice then cuts without slivers)
      const exact = S <= 2, sp = exact ? F.g : S, org = exact ? 0 : zeroOf && zeroOf(i0) ? 0 : S / 2, ox = exact ? F.x0 : org, oz = exact ? F.z0 : org, T3 = [i0, i1, i2];
      const emit = (pl) => { for (let e = 1; e + 1 < pl.length; e++) { const a = pl[0][0], c = pl[e][0], d = pl[e + 1][0]; if (a !== c && c !== d && a !== d) { out.push(a, c, d); if (srcOut) srcOut.push(source); } } };
      // keep the part of `poly` on one side of a lattice line (family f: 0 x, 1 z, 2 x + z; line number k at L; sgn +1 keeps the larger side)
      const clip = (f, k, L, sgn) => {
        next.length = 0; const n = poly.length, line = 10 + f * 1e6 + k + 5e5;
        for (let e = 0; e < n; e++) {
          const cur = poly[e], nx = poly[(e + 1) % n], va = cur[0], vb = nx[0];
          const da = ((f === 0 ? P[va * 3] : f === 1 ? P[va * 3 + 2] : P[va * 3] + P[va * 3 + 2]) - L) * sgn, db = ((f === 0 ? P[vb * 3] : f === 1 ? P[vb * 3 + 2] : P[vb * 3] + P[vb * 3 + 2]) - L) * sgn;
          const ia = da >= -1e-6, ib = db >= -1e-6;
          if (ia) next.push([va, ib ? cur[1] : cur[1]]);
          if (ia !== ib && Math.abs(da) > 1e-6 && Math.abs(db) > 1e-6) {
            // where this side meets the line: on a side of the triangle, or at a crossing of two lattice lines
            const c = cur[1]; let m;
            if (c < 3) m = corner(T3[c], T3[(c + 1) % 3], f, k, L);
            else {
              const f2 = Math.floor((c - 10) / 1e6), k2 = c - 10 - f2 * 1e6 - 5e5, L2 = (f2 === 0 ? ox : f2 === 1 ? oz : F.x0 + F.z0) + k2 * sp;
              let x, z;      // the two lines' crossing
              if (f === 0) { x = L; z = f2 === 1 ? L2 : L2 - L; } else if (f === 1) { z = L; x = f2 === 0 ? L2 : L2 - L; } else { if (f2 === 0) { x = L2; z = L - L2; } else { z = L2; x = L - L2; } }
              m = node(i0, i1, i2, x, z, s0 + ':' + Math.round(x * 100) + ':' + Math.round(z * 100));
            }
            next.push([m, ia ? line : c]);
          } else if (ia && !ib) next[next.length - 1][1] = line;       // (it leaves through a corner on the line itself)
        }
        // a side that now runs along the line is carried by the line
        for (let e = 0; e < next.length; e++) { const a = next[e], c = next[(e + 1) % next.length], qa = f === 0 ? P[a[0] * 3] : f === 1 ? P[a[0] * 3 + 2] : P[a[0] * 3] + P[a[0] * 3 + 2], qc = f === 0 ? P[c[0] * 3] : f === 1 ? P[c[0] * 3 + 2] : P[c[0] * 3] + P[c[0] * 3 + 2]; if (Math.abs(qa - L) < 1e-6 && Math.abs(qc - L) < 1e-6) a[1] = line; }
        const w = poly; poly = next; next = w;
      };
      if (flat) {
        // (walls and fences: the old way, one family at a time along the line they stand on)
        tri.length = 0; tri.push(i0, i1, i2, 0);
        while (tri.length) {
          const f = tri.pop(), v2 = tri.pop(), v1 = tri.pop(), v0 = tri.pop();
          if (f >= 2) { out.push(v0, v1, v2); if (srcOut) srcOut.push(source); continue; }
          const V = [v0, v1, v2];
          for (let e = 0; e < 3; e++) q[e] = f === 0 ? P[V[e] * 3] : P[V[e] * 3 + 2];
          const of = f === 0 ? ox : oz, lo = Math.min(q[0], q[1], q[2]), hi = Math.max(q[0], q[1], q[2]);
          const k0 = Math.ceil((lo - of) / sp + 1e-6), k1 = Math.floor((hi - of) / sp - 1e-6);
          if (k0 > k1) { tri.push(v0, v1, v2, f + 1); continue; }
          const k = (k0 + k1) >> 1, L = of + k * sp;
          let np = 0, nn = 0;
          for (let e = 0; e < 3; e++) { const d = q[e] - L; sd[e] = d > 1e-6 ? 1 : d < -1e-6 ? -1 : 0; if (sd[e] > 0) np++; else if (sd[e] < 0) nn++; }
          if (!np || !nn) { tri.push(v0, v1, v2, f + 1); continue; }
          let r = 0;
          if (np === 1 && nn === 1) r = sd[0] === 0 ? 0 : sd[1] === 0 ? 1 : 2;
          else r = np === 1 ? (sd[0] > 0 ? 0 : sd[1] > 0 ? 1 : 2) : (sd[0] < 0 ? 0 : sd[1] < 0 ? 1 : 2);
          const A = V[r], B = V[(r + 1) % 3], C = V[(r + 2) % 3];
          if (np === 1 && nn === 1) { const m = corner(B, C, f, k, L); tri.push(A, B, m, f, A, m, C, f); continue; }
          const mab = corner(A, B, f, k, L), mca = corner(C, A, f, k, L);
          tri.push(A, mab, mca, f, mab, B, C, f, mab, C, mca, f);
        }
        continue;
      }
      // every lattice square the triangle touches: the triangle clipped to it (and, at the finest, to each half of it)
      // (a lattice line within 3 cm of the triangle's own edge does not count: things built on round numbers overlap by a hair)
      const E3 = exact ? 0 : 0.03, ia0 = Math.floor((Math.min(x1, x2, x3) + E3 - ox) / sp), ia1 = Math.max(ia0, Math.floor((Math.max(x1, x2, x3) - E3 - ox) / sp)), ja0 = Math.floor((Math.min(z1, z2, z3) + E3 - oz) / sp), ja1 = Math.max(ja0, Math.floor((Math.max(z1, z2, z3) - E3 - oz) / sp));
      // (one square: nothing to cut. More than 4096 squares - a kilometre of ground in one triangle, a map emptied for a
      //  test: left whole; nothing a caller passes can make this run away)
      if ((ia0 === ia1 && ja0 === ja1 && !exact) || (ia1 - ia0 + 1) * (ja1 - ja0 + 1) > 4096) { out.push(i0, i1, i2); if (srcOut) srcOut.push(source); continue; }
      for (let j = ja0; j <= ja1; j++) for (let i = ia0; i <= ia1; i++) {
        poly.length = 0; poly.push([i0, 0], [i1, 1], [i2, 2]);
        // (the outermost squares keep what lies a hair beyond their outer lines)
        if (i > ia0 || exact) { clip(0, i, ox + i * sp, 1); if (poly.length < 3) continue; }
        if (i < ia1 || exact) { clip(0, i + 1, ox + (i + 1) * sp, -1); if (poly.length < 3) continue; }
        if (j > ja0 || exact) { clip(1, j, oz + j * sp, 1); if (poly.length < 3) continue; }
        if (j < ja1 || exact) { clip(1, j + 1, oz + (j + 1) * sp, -1); if (poly.length < 3) continue; }
        if (!exact) { emit(poly); continue; }
        // (the field's own diagonal through this square: x + z = its +x corner's)
        const kd = i + j + 1, Ld = F.x0 + F.z0 + kd * sp, keep = poly.map((p_) => p_.slice());
        clip(2, kd, Ld, -1); if (poly.length >= 3) emit(poly);
        poly = keep; clip(2, kd, Ld, 1); if (poly.length >= 3) emit(poly);
      }
    }
  }
  if (added || srcOut) { b.idx = out; TERRAIN.split += added; }
  return added;
}

installTerrain();
