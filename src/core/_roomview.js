// How a walk-in room is SEEN from outside it (core/interiors.js owns when; this file owns what is drawn).
//
// Every doorway and window of a room is an "op" (opening) with a quad on the building's shell face. Each frame, for the
// frame's camera, each op is given a kind:
//   NONE   not punched: the shell's own painted door / window is what is seen (beyond FAR m, or facing away);
//   IMP    an IMPOSTOR: the quad is painted from pictures of the room taken when it was built, all in one atlas texture
//          per room: (1) a TILE of what stands in the thickness of the wall at this opening — frame, glazing bars, sill,
//          blind — drawn straight on and shown at the wall's inner face (so it stays put in the hole as you walk past); a
//          doorway with a door has a second tile with its leaves closed, at twice the density: a shut door IS that tile,
//          at any distance; (2) behind it, six faces of a CUBE taken from just inside that wall, looked up along the ray
//          carried on to where it leaves the room's box (the far walls, floor and ceiling sit where they are and move
//          rightly). ONE draw call in the world's own pass for all such openings of a room: no room pass, none of the
//          room's lights, nothing of the room's scene traversed;
//   REAL   the room itself is drawn through the opening (stencil mark + depth reset on the quad, then the room's scene
//          over the screen rectangle of the REAL openings only, frustum narrowed to them);
//   BLEND  REAL, with the impostor laid over it at an alpha: the cross-fade between the two (no pop);
//   DIMP   a doorway whose leaf is moving or standing open, far off: the impostor's cube behind the leaf;
//   PIMP   an impostor with PEOPLE in it: the room has people and the opening is within PEOPLE_R of the eye. The hole is
//          punched and painted with the cube (depth far), then the room's people — the real, moving characters, lit by
//          the room's own lights, nothing else of the room — are drawn there (core/interiors.js afterWorld: a pass over
//          a list of the lights and the people, not over the room's scene), then the tile (frame, glazing bars) over them.
// REAL is for openings within NEAR m of the eye or of the player (whichever is nearer: a third-person camera well behind
// someone walking along a shop front still gets the real shop beside them); beyond that the impostor. In a vehicle, or
// seen from inside another room, always the impostor.
//
// A leaf that is moving or open, seen from beyond NEAR, is drawn in the WORLD's pass as a proxy: the leaf's own geometry
// painted with the closed-door tile (the same picture it had while shut, so nothing changes as it starts to move). Near
// by, the real leaf is drawn with the room.
//
// Seen from INSIDE, a room must not show its own parts that lie beyond one of its openings (an upper room beyond the
// loggia its stair hall's door looks along): each opening has a depth-only "cap" — a short tunnel from the hole out past
// the shell face — drawn first in the room's pass, so through the hole only the world is seen.
//
// Cost (2016 MacBook Pro, Radeon Pro 460): what matters is draw calls and passes — about 0.1 ms each there. A room in
// view costs one draw call; one with a door ajar far off three or four; a room pass only within NEAR of an opening.
import * as THREE from 'three';

export const K_NONE = 0, K_IMP = 1, K_REAL = 2, K_PIMP = 3, K_DIMP = 4, K_BLEND = 5;
const M_MARK = (1 << K_REAL) | (1 << K_BLEND) | (1 << K_DIMP) | (1 << K_PIMP), M_RESET = (1 << K_REAL) | (1 << K_BLEND), M_CUBE = (1 << K_DIMP) | (1 << K_PIMP);
// m: within this of an opening the room's people are drawn for real in its impostor (high / ultra: as far as the
// opening is punched at all — FAR0 / FAR1 — so a room seen across the street has its people in it)
export const PEOPLE_R = 24, PEOPLE_RT = { low: 24, medium: 24, high: 38, ultra: 46 };
// m from an opening (eye or player, the nearer): within [0] the room is drawn, beyond [1] its impostor, cross-faded between
// (high / ultra: the room itself from much further off — 12 m, and on ultra nearly as far as its openings are punched at
//  all; the 4.5–7.5 m they had were chosen to hold 60 fps on the 2016 laptop)
export const NEAR = { low: [2.4, 3.4], medium: [3, 4.4], high: [12, 16], ultra: [34, 40] };
export const FAR0 = 38, FAR1 = 46;      // m: impostors fade in over the painted shell between FAR1 and FAR0
const FACE = { low: 128, medium: 256, high: 448, ultra: 640 };      // cube face, px (a wall with only small windows: 0.6 of it)
const TILE = { low: 48, medium: 80, high: 128, ultra: 160 };       // atlas tiles, px per metre of opening (shut doors: twice)
const ATLAS = { low: [1024, 2048], medium: [1024, 2048], high: [2048, 2048], ultra: [2048, 4096] }, GUT = 4;      // the atlas, at most (w, h)
// Memory pass (2026-11-22): the pictures' DEPTH. Every room's atlas had a depth buffer of its own, the size of the atlas
// (2048 x 4096: 32 MB, next to 43 MB of picture) — used only while a picture is being taken, and every picture clears
// its own tile's depth first (impStep: clear, then draw, under one scissor). So all atlases of one size share one depth
// texture (the same 24 bits): six big rooms on the card hold 32 MB of depth, not 192. `?roomdepth=0`: one each, as before.
const SHARE_DEPTH = (() => { try { return !/[?&]roomdepth=0(&|$)/.test(globalThis.location ? globalThis.location.search : ''); } catch (e) { return true; } })();
const DEPTHS = new Map();
function sharedDepth(w, h) {
  if (!SHARE_DEPTH) return null;
  const k = w + 'x' + h; let d = DEPTHS.get(k);
  if (!d) { d = new THREE.DepthTexture(w, h); d.name = 'room pictures depth ' + k; DEPTHS.set(k, d); }
  return d;
}
/** take a room's atlas off the card without taking the shared depth texture with it (three disposes a target's depth texture) */
export function disposeAtlas(A) { if (!A) return; const d = A.depthTexture; if (d && DEPTHS.get(A.width + 'x' + A.height) === d) { A.depthTexture = null; try { A.dispose(); } finally { A.depthTexture = d; } } else A.dispose(); }
const REAL_BIT = 0x02;                   // stencil bit left where a REAL opening was reset (the room is drawn there)
// light rooms (seamless.light: the small premises of a shopping street, dozens in sight): the room itself within a
// shorter distance, a smaller picture — a 5 x 8 m shop behind one window is 80 pixels wide on the screen at 34 m
export const NEAR_L = { low: [2.4, 3.4], medium: [3, 4.4], high: [9, 12], ultra: [20, 26] };
const FACE_L = { low: 96, medium: 128, high: 192, ultra: 256 }, TILE_L = { low: 32, medium: 48, high: 64, ultra: 96 }, ATLAS_L = [1024, 1024];
const PROXY_BIT = 0x80;                  // stencil bit a door-leaf proxy sets (the cross-fade quad leaves those pixels alone)
const WARM = 2;                          // camera layer of the warm-up draws (as core/interiors.js)
const DARK = 'vec3(0.012, 0.012, 0.014)';
const _l = [0, 0], _v = new THREE.Vector3();
// the six faces: forward, up (right = forward x up); the shader below picks them the same way
const FACES = [[1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0], [0, 0, 1, 0, 1, 0], [0, 0, -1, 0, 1, 0], [0, 1, 0, 0, 0, 1], [0, -1, 0, 0, 0, 1]];

const VS = 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const IMP_VS = `attribute float aFade; attribute vec2 aQ; attribute vec4 aTile; attribute vec3 aNrm; attribute vec2 aSize; attribute vec3 aMin; attribute vec3 aMax; attribute vec3 aPos; attribute vec3 aCube;
varying vec3 vP; varying vec3 vC; varying float vA; varying vec2 vQ; varying vec4 vTile; varying vec3 vN; varying vec2 vS; varying vec3 vMin; varying vec3 vMax; varying vec3 vPos; varying vec3 vCube;
void main(){ vP = position; vC = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz; vA = aFade; vQ = aQ; vTile = aTile; vN = aNrm; vS = aSize; vMin = aMin; vMax = aMax; vPos = aPos; vCube = aCube;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// (the ray from the eye through the quad: first what stands in the wall's thickness — the tile, met at the wall's inner
//  face; then carried on to where it leaves the room's box, where the cube's faces are looked up from the point they were
//  taken at. The room's picture is at exposure 1 whatever the world's is. Both pictures were drawn over nothing, so their
//  colour is already weighted by how much of the pixel they covered.)
const IMP_FS = `uniform sampler2D tFront; uniform vec2 uAtl; uniform float uInvExp;
varying vec3 vP; varying vec3 vC; varying float vA; varying vec2 vQ; varying vec4 vTile; varying vec3 vN; varying vec2 vS; varying vec3 vMin; varying vec3 vMax; varying vec3 vPos; varying vec3 vCube;
void main(){
  vec3 d = normalize(vP - vC); d += (1.0 - step(1e-5, abs(d))) * 1e-5;
  float t;
  if (vMax.x < -1e8) {      // (no box to trust: a made-up one square to this wall — its back vMin.x behind the wall, its sides vMin.y either side of the point the cube was taken at)
    vec3 o = vP - vPos; float on = o.x * vN.x + o.z * vN.y, dn = d.x * vN.x + d.z * vN.y, ot = o.x * vN.y - o.z * vN.x, dt = d.x * vN.y - d.z * vN.x;
    float tn = (-(vMin.x - vN.z) - on) / min(dn, -0.02), tt = (sign(dt) * vMin.y - ot) / (abs(dt) > 1e-4 ? dt : 1e-4);
    t = max(min(tn, tt), 0.05);
  }
  else { vec3 tm = max((vMin - vP) / d, (vMax - vP) / d); t = max(min(tm.x, min(tm.y, tm.z)), 0.05); }
  vec3 v = vP + d * t - vPos, a = abs(v), f, u; float face;
  if (a.x >= a.y && a.x >= a.z) { f = vec3(sign(v.x), 0.0, 0.0); u = vec3(0.0, 1.0, 0.0); face = v.x > 0.0 ? 0.0 : 1.0; }
  else if (a.z >= a.y) { f = vec3(0.0, 0.0, sign(v.z)); u = vec3(0.0, 1.0, 0.0); face = v.z > 0.0 ? 2.0 : 3.0; }
  else { f = vec3(0.0, sign(v.y), 0.0); u = vec3(0.0, 0.0, 1.0); face = v.y > 0.0 ? 4.0 : 5.0; }
  vec2 st = vec2(dot(v, cross(f, u)), dot(v, u)) / dot(v, f) * 0.5 + 0.5;
  float n = vCube.z, hp = 0.5 / n, row = floor(face / 3.0 + 0.01), colm = face - row * 3.0;
  vec2 cuv = (vCube.xy + vec2(colm, row) * (n + ${(2 * GUT).toFixed(1)}) + clamp(st, hp, 1.0 - hp) * n) * uAtl;
  vec3 vn = normalize(v); float lod = clamp(log2(max(length(dFdx(vn)), length(dFdy(vn))) * n * 0.64), 0.0, 3.0);
  vec4 c = textureLod(tFront, cuv, lod);
  float s = vN.z / max(-(d.x * vN.x + d.z * vN.y), 0.08);
  vec2 q = clamp(vQ + vec2((d.x * vN.y - d.z * vN.x) * s / vS.x, d.y * s / vS.y), 0.0, 1.0);
  vec4 fr = texture2D(tFront, vTile.xy + q * vTile.zw);
  #ifdef TILE_ONLY
  gl_FragColor = vec4(fr.rgb / max(fr.a, 1e-3) * uInvExp, fr.a);
  #else
  float cov = fr.a + (1.0 - fr.a) * clamp(c.a, 0.0, 1.0);
  gl_FragColor = vec4((fr.rgb + c.rgb * (1.0 - fr.a)) / max(cov, 1e-3) * uInvExp, vA);
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifndef TILE_ONLY
  gl_FragColor.rgb = mix(${DARK}, gl_FragColor.rgb, cov);
  #endif
  #ifdef FAR_DEPTH
  gl_FragDepth = 1.0;
  #endif
}`;
const LEAF_VS = 'attribute vec2 aUv; varying vec2 vUv; void main(){ vUv = aUv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const LEAF_FS = `uniform sampler2D tFront; uniform float uInvExp; varying vec2 vUv;
void main(){ vec4 c = texture2D(tFront, vUv); gl_FragColor = vec4(c.rgb / max(c.a, 1e-3) * uInvExp, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ONE program per kind of unlit room-side material, whatever room it is drawn in. three keys a material's programs by
// (among much else) the numbers of lights in the scene being drawn — for a material that has no lighting in it too — so
// the cross-fade quad, the people pass's tile quad and the caps, each drawn with its own room's lights about it, were a
// separate identical program per combination of lights met: 14 + 12 + 10 of the 312 programs at Play, each a link.
// Here such a material's own table of programs (renderer.properties.get(material).programs: the Map three looks its
// program up in) is one that answers by what DOES change the shader — the kind of material and whether the picture is
// going to the screen or into a target (colour space, tone mapping) — and hands every material of the kind the same
// program. (three r169 internals: WebGLRenderer getProgram(). Without them — another three, no renderer — nothing is
// changed and every material gets programs as three makes them.)
const SHARED = new Map();
class SharedPrograms extends Map {
  constructor(R, kind) { super(); this.R = R; this.kind = kind; }
  sig() { const R = this.R, t = R.getRenderTarget ? R.getRenderTarget() : null; return this.kind + (t ? '|target' : '|screen|' + R.outputColorSpace + '|' + R.toneMapping); }
  get() { const k = this.sig(); let p = super.get(k); if (p === undefined) { p = SHARED.get(k); if (p !== undefined) { if (p.program === undefined) { SHARED.delete(k); return undefined; } p.usedTimes++; super.set(k, p); } } return p; }
  set(key, p) { const k = this.sig(); SHARED.set(k, p); return super.set(k, p); }
}
export function shareProgram(I, mat, kind) {
  try { const R = I.game.renderer, pr = !I.noShare && R && R.properties && R.properties.get ? R.properties.get(mat) : null; if (pr && pr.programs === undefined && mat.isShaderMaterial) {
      pr.programs = new SharedPrograms(R, kind);
      // (three sets a material's uniforms table only when it MAKES the material's program; a material handed a program
      //  another one made must have it already, or the first draw fails in WebGLUniforms.seqWithValue — a ShaderMaterial's
      //  table is its own `uniforms`. Only ShaderMaterials are shared for that reason.)
      pr.uniforms = mat.uniforms;
    } } catch { /* as three makes them */ }
  return mat;
}
export const sharedPrograms = () => SHARED.size;
/** multiply everything in the bound target by k (one quad, no depth, no stencil): core/interiors.js renderFrame */
let _scale = null;
export function scaleTarget(I, R, k) {
  if (!_scale) {
    const m = new THREE.ShaderMaterial({ name: 'interiorScale', vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'uniform float uK; void main(){ gl_FragColor = vec4(vec3(uK), 1.0); }', uniforms: { uK: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false;
    _scale = { m, s: new THREE.Scene(), c: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) }; _scale.s.add(q);
  }
  _scale.m.uniforms.uK.value = k; _scale.m.uniformsNeedUpdate = true;
  const ac = R.autoClear; R.autoClear = false; try { R.render(_scale.s, _scale.c); } finally { R.autoClear = ac; }
}
/** the shared materials of the punched openings (one set per game) */
export function punchMats(I) {
  if (I._punchMats) return I._punchMats;
  // Three materials over the same quads (which face outwards, so from inside the building they are not drawn at all):
  //   mark  : where the opening is the nearest thing (ordinary depth test), set the stencil; draws nothing
  //   reset : where the stencil is set, paint the dark of an unlit room and put the depth back to "far" (depth func
  //           ALWAYS: no reliance on when a written depth is tested), clearing the stencil — the room / the leaf is then
  //           drawn there by the ordinary depth test;
  //   soft  : the one-pass version (depth written from the shader, tested as the driver sees fit) for a target that has
  //           no stencil buffer (none of the game's own now: the post pass's scene target has one, world/post.js).
  return (I._punchMats = {
    mark: new THREE.ShaderMaterial({ name: 'interiorPunchMark', vertexShader: VS, fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }', colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp }),
    reset: new THREE.ShaderMaterial({ name: 'interiorPunch', vertexShader: VS, fragmentShader: `void main(){ gl_FragColor = vec4(${DARK}, 1.0); gl_FragDepth = 1.0; }`, depthFunc: THREE.AlwaysDepth, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilZPass: THREE.IncrementStencilOp }),      // (1 -> 2: REAL_BIT, "the room itself is drawn at this pixel" — see `expose`)
    // expose: the room drawn into the post pass's scene target (world/post.js) is tone-mapped there with everything
    // else at the OUTDOOR exposure (at night well over 1), while a room is at exposure 1 — inside it, on the tiers with
    // no post pass, and in its picture. So after the room: its pixels (REAL_BIT) are multiplied by 1 / exposure.
    expose: new THREE.ShaderMaterial({ name: 'interiorExpose', vertexShader: VS, fragmentShader: 'uniform float uK; void main(){ gl_FragColor = vec4(vec3(uK), 1.0); }', uniforms: { uK: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      stencilWrite: true, stencilRef: REAL_BIT, stencilFuncMask: REAL_BIT, stencilWriteMask: REAL_BIT, stencilFunc: THREE.EqualStencilFunc, stencilZPass: THREE.ZeroStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp }),
    soft: new THREE.ShaderMaterial({ name: 'interiorPunchSoft', vertexShader: VS, fragmentShader: `void main(){ gl_FragColor = vec4(${DARK}, 1.0); gl_FragDepth = 1.0; }` }),
    cap: new THREE.ShaderMaterial({ name: 'interiorCap', vertexShader: VS, fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }', colorWrite: false, side: THREE.DoubleSide }),      // (a ShaderMaterial: one program for every room — shareProgram)
  });
}
function impBefore(r, scene, camera, geometry, material) {
  // (a pass that draws the world with scene.overrideMaterial — world/_fx_skylight.js, _fx_grass.js — hands this hook
  //  ITS material, which has no such uniform: nothing to set then)
  const u = material && material.uniforms && material.uniforms.uInvExp; if (!u) return;
  // (a room's picture is at exposure 1 whatever the world's is — on the screen, and in the post pass's scene target,
  //  which is tone-mapped later at the world's exposure; the cross-fade quad, drawn in the room's own pass into that
  //  target, is brought to 1 with the room: `expose`)
  const v = material.userData.roomPass && r.getRenderTarget && r.getRenderTarget() ? 1 : 1 / (r.toneMappingExposure || 1);
  if (u.value !== v) { u.value = v; material.uniformsNeedUpdate = true; }
}
function impMat(S, kind) {
  const u = { tFront: { value: S.atlas.texture }, uAtl: { value: new THREE.Vector2(1 / S.atlas.width, 1 / S.atlas.height) }, uInvExp: { value: 1 } };
  const o = { vertexShader: IMP_VS, fragmentShader: IMP_FS, uniforms: u, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor };
  // (drawn with the see-through things, last of them: the shell's lit-window glow at night is one of those and must not cover it)
  if (kind === 'imp') return new THREE.ShaderMaterial({ name: 'interiorImpostor', ...o, transparent: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  if (kind === 'door') return new THREE.ShaderMaterial({ name: 'interiorImpostorDoor', ...o, blending: THREE.NoBlending, defines: { FAR_DEPTH: 1 }, depthFunc: THREE.AlwaysDepth, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilZPass: THREE.ZeroStencilOp });
  if (kind === 'doorSoft') return new THREE.ShaderMaterial({ name: 'interiorImpostorSoft', ...o, blending: THREE.NoBlending, defines: { FAR_DEPTH: 1 } });
  if (kind === 'tile') return new THREE.ShaderMaterial({ name: 'interiorImpostorTile', ...o, defines: { TILE_ONLY: 1 }, depthWrite: false });
  if (kind === 'leaf') return new THREE.ShaderMaterial({ name: 'interiorLeaf', vertexShader: LEAF_VS, fragmentShader: LEAF_FS, uniforms: { tFront: u.tFront, uInvExp: { value: 1 } }, stencilWrite: true, stencilRef: PROXY_BIT, stencilWriteMask: PROXY_BIT, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
  // the cross-fade, in the room's own pass: after the room's opaque things, not over a door-leaf proxy
  return new THREE.ShaderMaterial({ name: 'interiorImpostorFade', ...o, depthWrite: false, stencilWrite: true, stencilRef: PROXY_BIT, stencilFuncMask: PROXY_BIT, stencilWriteMask: 0, stencilFunc: THREE.NotEqualStencilFunc });
}

/** at registration: the list of ops (doorways first, then windows) */
export function setupOps(S) {
  S.ops = [];
  for (const p of S.portals) S.ops.push({ o: p, portal: true, w: p.w, y0: p.y, y1: p.y + p.h, quad: p.punch !== false, qi: -1, kind: K_NONE, a: 0, cell: null });
  for (const o of S.openings) S.ops.push({ o, portal: false, w: o.w, y0: o.y0, y1: o.y1, quad: o.punch !== false, qi: -1, kind: K_NONE, a: 0, cell: null });
}
const ATTRS = [['aQ', 'pQ'], ['aTile', 'pTile'], ['aNrm', 'pNrm'], ['aSize', 'pSize'], ['aMin', 'pMin'], ['aMax', 'pMax'], ['aPos', 'pCam'], ['aCube', 'pCube']];
function opGeo(S, full) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', S.pPos); geo.setAttribute('aFade', S.pFade);
  for (const [n, k] of ATTRS) geo.setAttribute(n, S[k]);
  const ix = new THREE.BufferAttribute(new Uint16Array(S.nq * 6), 1); ix.setUsage(THREE.DynamicDrawUsage); geo.setIndex(ix); geo.setDrawRange(0, 0);
  if (full) { for (let i = 0; i < ix.array.length; i++) ix.array[i] = i; geo.setDrawRange(0, ix.array.length); }      // (every quad until the first frame sorts them: tools ray-cast it)
  return geo;
}
function setIdx(geo, S, mask) {
  const ix = geo.index, a = ix.array; let n = 0;
  for (const op of S.ops) if (op.qi >= 0 && (mask >> op.kind) & 1) { const b = op.qi * 6; for (let k = 0; k < 6; k++) a[n++] = b + k; }
  if (n || geo.drawRange.count) { geo.setDrawRange(0, n); ix.needsUpdate = true; }
  return n;
}
function worldMesh(I, S, geo, mat, order, name) {
  const m = new THREE.Mesh(geo, mat); m.name = name; m.renderOrder = order; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.visible = false; m.frustumCulled = false;
  I.game.worldScene.add(m); S.wm.push(m); return m;
}
/** at registration: the quads on the shell face (one per op that is punched) and the meshes that mark / reset them */
export function buildPunch(I, d) {
  const S = d.sl, g = I.game; S.wm = [];
  if (!g.worldScene) return;
  const Q = S.ops.filter((op) => op.quad); if (!Q.length) return;
  const n = Q.length, P = new Float32Array(n * 18), UV = new Float32Array(n * 12), NR = new Float32Array(n * 18), SZ = new Float32Array(n * 12); let i = 0;
  const tri = (a, b, c) => { for (const v of [a, b, c]) { P[i++] = v[0]; P[i++] = v[1]; P[i++] = v[2]; } };
  Q.forEach((op, qi) => {
    const o = op.o, w = op.w, k = o.depth + (o.proud ?? 0.03), cx = o.at[0] + o.dx * k, cz = o.at[1] + o.dz * k;
    const A = [cx - o.tx * w / 2, op.y0, cz - o.tz * w / 2], B = [cx + o.tx * w / 2, op.y0, cz + o.tz * w / 2], C = [B[0], op.y1, B[2]], D = [A[0], op.y1, A[2]];
    tri(A, B, C); tri(A, C, D); op.qi = qi; op.k = k;      // (wound to face outwards: AB = the tangent (cos out, -sin out), x up = the outward normal)
    UV.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], qi * 12);
    for (let v = 0; v < 6; v++) { NR[qi * 18 + v * 3] = o.dx; NR[qi * 18 + v * 3 + 1] = o.dz; NR[qi * 18 + v * 3 + 2] = k; SZ[qi * 12 + v * 2] = w; SZ[qi * 12 + v * 2 + 1] = op.y1 - op.y0; }
  });
  S.nq = n; S.pPos = new THREE.BufferAttribute(P, 3); S.pFade = new THREE.BufferAttribute(new Float32Array(n * 6), 1); S.pFade.setUsage(THREE.DynamicDrawUsage);
  S.pQ = new THREE.BufferAttribute(UV, 2); S.pNrm = new THREE.BufferAttribute(NR, 3); S.pNrm.setUsage(THREE.DynamicDrawUsage); S.pSize = new THREE.BufferAttribute(SZ, 2);
  S.pTile = new THREE.BufferAttribute(new Float32Array(n * 24), 4); S.pTile.setUsage(THREE.DynamicDrawUsage);
  S.pMin = new THREE.BufferAttribute(new Float32Array(n * 18), 3); S.pMax = new THREE.BufferAttribute(new Float32Array(n * 18), 3); S.pCam = new THREE.BufferAttribute(new Float32Array(n * 18), 3); S.pCube = new THREE.BufferAttribute(new Float32Array(n * 18), 3);
  const M = punchMats(I);
  S.gMark = opGeo(S, true); S.gReset = opGeo(S, true);
  S.punchMark = worldMesh(I, S, S.gMark, M.mark, 1e6, 'punch:' + d.id); S.punch = worldMesh(I, S, S.gReset, M.reset, 1e6 + 1, 'punch:' + d.id); S.punchSoft = worldMesh(I, S, S.gReset, M.soft, 1e6 + 2, 'punch:' + d.id);
  S.punchPending = true;
}
/** the world meshes of a room take its frame (once the ground under its door is known) */
export function placeWorldMeshes(S) {
  const mw = S.mw || (S.mw = new THREE.Matrix4()); S.matrix(mw); (S.mwi || (S.mwi = new THREE.Matrix4())).copy(mw).invert();
  for (const m of S.wm || []) { m.matrix.copy(mw); m.matrixWorld.copy(mw); m.matrixWorldNeedsUpdate = false; }
  S.proxyDirty = true;
}
const tierName = (g) => { const q = g.quality; return (q && (q.level || (q.tier && q.tier.name))) || 'medium'; };
/** which tile of the atlas op's quad shows: the doorway open (what stands in the wall), or with its leaves closed */
function setTile(S, op, shut) {
  if (op.shutTile === shut) return; op.shutTile = shut;
  const t = shut && op.tile2 ? op.tile2 : op.tile, T = S.pTile.array, W = S.atlas.width, H = S.atlas.height, u0 = (t[0] + 0.5) / W, v0 = (t[1] + 0.5) / H, du = (t[2] - 1) / W, dv = (t[3] - 1) / H;
  for (let v = 0, b = op.qi * 24; v < 6; v++, b += 4) { T[b] = u0; T[b + 1] = v0; T[b + 2] = du; T[b + 3] = dv; }
  S.pTile.needsUpdate = true;
  // (and how far behind the quad that picture stands: the wall's inner face; a shut leaf: the door's own plane)
  const kd = shut && op.tile2 ? op.kShut : op.kOpen, NR = S.pNrm.array;
  for (let v = 0, b = op.qi * 18 + 2; v < 6; v++, b += 3) NR[b] = kd;
  S.pNrm.needsUpdate = true;
}

/** when the room is built: the caps of its openings; its impostor (the atlas: per wall of the room that has openings a
 *  cube's six faces, per opening a tile); the proxies of its outside doors' leaves */
export function builtView(I, d) {
  const S = d.sl, g = I.game, R = g.renderer;
  S.cells = []; S.impOK = false; S.impDone = false; S.impFace = 0; S.impAge = 0; S.proxies = []; S.cap = null; S.atlas = null; S.steps = [];
  // ---- caps (seen from inside: nothing of the room beyond its own openings)
  try {
    const V = [];
    const quad = (a, b, c, e) => { V.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], e[0], e[1], e[2]); };
    for (const op of S.ops) {
      const o = op.o; if (o.cap === false) continue;
      const door = op.portal ? o.door : null, e = 0.03, hw = op.w / 2 + e, ya = op.y0 - e, yb = op.y1 + e, s0 = 0.012;
      const L = o.capDepth ?? (o.depth + (o.proud ?? 0.03) + (door && door.kind === 'hinged' ? door.o.w + 0.2 : 0.45));
      const pt = (lat, y, s) => [o.at[0] + o.tx * lat + o.dx * s, y, o.at[1] + o.tz * lat + o.dz * s];
      const a0 = pt(-hw, ya, s0), b0 = pt(hw, ya, s0), c0 = pt(hw, yb, s0), e0 = pt(-hw, yb, s0), a1 = pt(-hw, ya, L), b1 = pt(hw, ya, L), c1 = pt(hw, yb, L), e1 = pt(-hw, yb, L);
      quad(a0, a1, e1, e0); quad(b0, b1, c1, c0); quad(a0, b0, b1, a1); quad(e0, c0, c1, e1); quad(a1, b1, c1, e1);
    }
    if (V.length) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V), 3));
      const m = (S.cap = new THREE.Mesh(geo, shareProgram(I, punchMats(I).cap, 'cap'))); m.name = 'cap:' + d.id; m.renderOrder = -1e6; m.matrixAutoUpdate = false; m.frustumCulled = false; m.visible = false; m.castShadow = false; m.receiveShadow = false; m.userData.noSplit = true; m.userData.view = true;
      d.scene.add(m);
    }
  } catch (e) { console.warn('[interiors] caps', d.id, e); }
  if (!g.worldScene || !S.gMark) return;
  if (S.impostor === false || I.noCubes || !R || !R.capabilities || !R.capabilities.isWebGL2 || !R.setRenderTarget) return;
  try {
    const bb = d.box, fin = bb && isFinite(bb.min.x) && isFinite(bb.max.x) && isFinite(bb.min.y) && isFinite(bb.max.y);
    const boxes = S.bounds && S.bounds.length ? S.bounds : fin ? [{ x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z, y0: bb.min.y, y1: bb.max.y }] : null;
    if (!boxes) return;
    const tier = tierName(g), ops = S.ops.filter((op) => op.qi >= 0), [ATLAS_W, ATLAS_H] = S.light ? ATLAS_L : ATLAS[tier] || ATLAS.medium;
    // ---- cells: the openings of one wall of one box of the room (in runs of 14 m along it)
    const free = (x2, z2) => { for (const col of d.colliders) if (col.isFree && !col.isFree(x2, z2, 0.25)) return false; return true; };
    for (const op of ops) {
      const o = op.o, x = o.at[0] - o.dx * 0.45, z = o.at[1] - o.dz * 0.45, y = (op.y0 + op.y1) / 2; let best = null, bd = 1e9;
      for (const b of boxes) { const dist = Math.max(b.x0 - x, 0, x - b.x1) + Math.max(b.z0 - z, 0, z - b.z1) + Math.max((b.y0 ?? -1e9) - y, 0, y - (b.y1 ?? 1e9)); if (dist < bd) { bd = dist; best = b; } }
      const dir = Math.round(o.out / (Math.PI / 4)) & 7, lat = o.at[0] * o.tx + o.at[1] * o.tz;
      let c = S.cells.find((q) => q.b === best && q.dir === dir && Math.abs(lat - q.lat0) < 14);
      if (!c) {
        const y0 = best.y0 ?? (fin ? bb.min.y : 0), y1 = best.y1 ?? (fin ? bb.max.y : y0 + 3);
        c = { b: best, dir, lat0: lat, ops: [], min: [best.x0, y0, best.z0], max: [best.x1, y1, best.z1], pos: new THREE.Vector3(), cube: [0, 0, 0] };
        S.cells.push(c);
      }
      c.ops.push(op); op.cell = c;
    }
    for (const c of S.cells) {
      // the point the cube is taken from: just inside the wall, at the middle of the wall's openings, at eye height —
      // moved further in (then along) off anything solid standing there
      let sx = 0, sz = 0, sy = 0; const o0 = c.ops[0].o; c.wide = false;
      for (const op of c.ops) { sx += op.o.at[0]; sz += op.o.at[1]; sy += op.portal ? op.y0 + 1.5 : (op.y0 + op.y1) / 2; if (op.portal || op.w > 2) c.wide = true; }
      // (1.2 m in — what stands nearer the glass than that is in the tiles, drawn at its true size; a shallow room: a third of its depth)
      let deep = 0; for (const bx of [c.min[0], c.max[0]]) for (const bz of [c.min[2], c.max[2]]) deep = Math.max(deep, (o0.at[0] - bx) * o0.dx + (o0.at[1] - bz) * o0.dz);
      const k0 = Math.max(0.5, Math.min(1.2, deep * 0.33));
      const n = c.ops.length, mx = sx / n, mz = sz / n; let px = mx - o0.dx * k0, pz = mz - o0.dz * k0;
      search: if (!free(px, pz)) for (const k of [k0 + 0.4, k0 + 0.9, Math.max(0.4, k0 - 0.4), k0 + 1.5]) for (const l of [0, 0.5, -0.5, 1.1, -1.1]) { const x2 = mx - o0.dx * k + o0.tx * l, z2 = mz - o0.dz * k + o0.tz * l; if (free(x2, z2)) { px = x2; pz = z2; break search; } }
      c.pos.set(px, Math.max(c.min[1] + 0.3, Math.min(c.max[1] - 0.2, sy / n)), pz);
      // (an opening may say where its wall's cube is taken from: capture: [x, y, z])
      for (const op of c.ops) if (op.o.capture) { c.pos.set(op.o.capture[0], op.o.capture[1], op.o.capture[2]); break; }
      // how far inside the wall face that is: the tiles take in everything up to it (nothing between the two pictures)
      c.inset = Math.max(0.2, Math.min(3, (o0.at[0] - c.pos.x) * o0.dx + (o0.at[1] - c.pos.z) * o0.dz)) + 0.02;
      // a wall that is not square to the room's box (and no bounds declared to say what the room is), or the room says
      // so (seamless.backdrop: metres — vaults, odd plans): a flat backdrop that far behind the wall instead of the box
      c.plane = S.backdrop ?? (!(S.bounds && S.bounds.length) && Math.abs(Math.sin(2 * o0.out)) > 0.17 ? 9 : 0);
    }
    // ---- the atlas: shelf-packed, everything made smaller until it fits
    let AH = 64;
    for (let k = 1, tries = 0; tries < 8; tries++, k *= 0.75) {
      const face = ((S.light ? FACE_L : FACE)[tier] || 160) * k, den = ((S.light ? TILE_L : TILE)[tier] || 80) * k; let x = 0, y = 0, rowH = 0;
      const put = (w, h) => { if (x + w > ATLAS_W) { x = 0; y += rowH; rowH = 0; } const r = [x, y]; x += w; rowH = Math.max(rowH, h); return r; };
      for (const c of S.cells) { const N = Math.max(24, Math.round(c.wide ? face : face * 0.6)), r = put(3 * (N + 2 * GUT), 2 * (N + 2 * GUT)); c.cube[0] = r[0] + GUT; c.cube[1] = r[1] + GUT; c.cube[2] = N; }
      for (const op of ops) for (let j = 0; j < (op.portal && op.o.door ? 2 : 1); j++) {
        const dj = den * (j ? 2 : 1), tw = Math.max(8, Math.min(ATLAS_W - 2 * GUT, Math.ceil(op.w * dj))), th = Math.max(8, Math.min(640, Math.ceil((op.y1 - op.y0) * dj))), r = put(tw + 2 * GUT, th + 2 * GUT), t = [r[0] + GUT, r[1] + GUT, tw, th];
        if (j) op.tile2 = t; else { op.tile = t; op.tile2 = null; }
      }
      const H = y + rowH; AH = 64; while (AH < H) AH *= 2; if (AH <= ATLAS_H) break;
    }
    S.atlas = new THREE.WebGLRenderTarget(ATLAS_W, AH, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthTexture: sharedDepth(ATLAS_W, AH) });
    // per-quad data of the cell it belongs to
    for (const op of ops) {
      const c = op.cell; op.shutTile = null;
      op.kOpen = Math.max(0.02, op.o.tileDepth ?? op.k); op.kShut = op.kOpen;
      if (op.portal && op.o.doors && op.o.doors.length) { let m = 0; for (const D of op.o.doors) m += (D.o.at[0] - op.o.at[0]) * op.o.dx + (D.o.at[1] - op.o.at[1]) * op.o.dz; op.kShut = Math.max(0.02, Math.min(op.k + 0.5, op.k - m / op.o.doors.length)); }
      setTile(S, op, false);
      for (let v = 0, b = op.qi * 18; v < 6; v++, b += 3) { S.pMin.array.set(c.min, b); S.pMax.array.set(c.max, b); if (c.plane > 0) { S.pMin.array[b] = c.plane; S.pMin.array[b + 1] = S.backdropW ?? 6; S.pMax.array[b] = -1e9; } S.pCam.array[b] = c.pos.x; S.pCam.array[b + 1] = c.pos.y; S.pCam.array[b + 2] = c.pos.z; S.pCube.array.set(c.cube, b); }
    }
    for (const a of [S.pMin, S.pMax, S.pCam, S.pCube]) a.needsUpdate = true;
    // the steps of taking it: a cube face, or two tiles
    for (const c of S.cells) for (let f = 0; f < 6; f++) S.steps.push({ c, f });
    { let cur = null; for (const op of ops) for (const shut of op.tile2 ? [false, true] : [false]) { if (!cur || cur.tiles.length >= 2) S.steps.push((cur = { tiles: [] })); cur.tiles.push({ op, t: shut ? op.tile2 : op.tile, shut }); } }
    // ---- the meshes: all the room's impostor quads in one draw; doorways with a leaf moving; the cross-fade
    S.gImp = opGeo(S); S.gDoor = opGeo(S); S.gBlend = opGeo(S);
    { const bx = new THREE.Box3(); for (let v = 0; v < S.pPos.count; v++) bx.expandByPoint(_v.fromBufferAttribute(S.pPos, v)); const sp = new THREE.Sphere(); bx.getBoundingSphere(sp); S.gImp.boundingSphere = sp; S.gDoor.boundingSphere = sp; }
    S.mImp = worldMesh(I, S, S.gImp, impMat(S, 'imp'), 1e6 + 2, 'impostor:' + d.id); S.mDoor = worldMesh(I, S, S.gDoor, impMat(S, 'door'), 1e6 + 1, 'impostor:' + d.id);
    S.mSoft = worldMesh(I, S, S.gDoor, impMat(S, 'doorSoft'), 1e6 + 2, 'impostor:' + d.id); S.mSoft.onBeforeRender = impBefore;
    S.gTile = opGeo(S); { const mt = (S.mTile = new THREE.Mesh(S.gTile, shareProgram(I, impMat(S, 'tile'), 'tile'))); mt.name = 'impostorTile'; mt.renderOrder = 1e5; mt.matrixAutoUpdate = false; mt.frustumCulled = false; mt.onBeforeRender = impBefore; }
    S.mImp.frustumCulled = true; S.mDoor.frustumCulled = true;
    const mb = (S.mBlend = new THREE.Mesh(S.gBlend, shareProgram(I, impMat(S, 'fade'), 'fade'))); mb.material.userData.roomPass = true;
    { const me = (S.mExp = new THREE.Mesh(S.gReset, shareProgram(I, punchMats(I).expose, 'expose'))); me.name = 'expose'; me.renderOrder = 2e5; me.matrixAutoUpdate = false; me.frustumCulled = false; me.visible = false; me.castShadow = false; me.receiveShadow = false; me.userData.noSplit = true; me.userData.view = true; d.scene.add(me); } mb.name = 'impostorFade'; mb.renderOrder = 1e5; mb.matrixAutoUpdate = false; mb.frustumCulled = false; mb.visible = false; mb.castShadow = false; mb.receiveShadow = false; mb.userData.noSplit = true; mb.userData.view = true; d.scene.add(mb);
    for (const m of [S.mImp, S.mDoor, mb]) m.onBeforeRender = impBefore;
    // ---- door-leaf proxies: the opaque parts of the leaves of doors on a doorway to the world, painted with the
    //      closed-door tile (each vertex where it is in that picture when the door is shut)
    const root = (S.proxyRoot = new THREE.Group()); root.name = 'doorProxies:' + d.id; root.matrixAutoUpdate = false; g.worldScene.add(root);
    const lm = (S.leafMat = impMat(S, 'leaf'));
    for (const D of d.doorList) {
      const P = D.portalRef; if (!P) continue;
      const op = S.ops.find((q) => q.o === P); if (!op || op.qi < 0 || !op.tile2) continue;
      D.proxies = [];
      const ry = D.group.rotation.y, sl = D.slide;
      if (D.kind === 'hinged') D.group.rotation.y = D.o.dir; else { D.slide = 0; D._place(); }
      D.group.updateMatrixWorld(true);
      const t = op.tile2, W = S.atlas.width, H = S.atlas.height, h = op.y1 - op.y0;
      D.group.traverse((o) => {
        if (!o.isMesh || !o.material || Array.isArray(o.material) || o.material.transparent || !o.geometry || !o.geometry.attributes.position) return;
        const src = o.geometry, pos = src.attributes.position, uv = new Float32Array(pos.count * 2);
        for (let v = 0; v < pos.count; v++) {
          _v.fromBufferAttribute(pos, v).applyMatrix4(o.matrixWorld);
          const a = Math.max(0, Math.min(1, ((_v.x - P.at[0]) * P.tx + (_v.z - P.at[1]) * P.tz) / op.w + 0.5)), b = Math.max(0, Math.min(1, (_v.y - op.y0) / h));
          uv[v * 2] = (t[0] + 0.5 + a * (t[2] - 1)) / W; uv[v * 2 + 1] = (t[1] + 0.5 + b * (t[3] - 1)) / H;
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', pos); if (src.index) geo.setIndex(src.index); geo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2)); geo.boundingSphere = src.boundingSphere || null; if (!geo.boundingSphere) geo.computeBoundingSphere();
        const q = new THREE.Mesh(geo, lm); q.name = 'doorProxy'; q.matrixAutoUpdate = false; q.renderOrder = 1e6 + 1.5; q.visible = false; q.castShadow = false; q.receiveShadow = false; q.onBeforeRender = impBefore;
        root.add(q); const e = { src: o, mesh: q, door: D, op, th: NaN, sl: NaN }; S.proxies.push(e); D.proxies.push(e);
      });
      if (D.kind === 'hinged') D.group.rotation.y = ry; else { D.slide = sl; D._place(); }
      D.group.updateMatrixWorld(true);
    }
    S.proxyDirty = true;
    S.impOK = S.cells.length > 0;
  } catch (e) { console.warn('[interiors] impostor', d.id, e); S.impOK = false; }
  if (!S.punchPending) placeWorldMeshes(S);
}

/** one step of taking the room's impostor: a face of one of its cubes, or two of its tiles (a room's first set must be
 *  whole before it is shown; later sets refresh it in place) */
export function impStep(I, d) {
  const S = d.sl, g = I.game, R = g.renderer, A = S.atlas;
  if (!S.impOK || !A || !S.steps.length) { S.impDone = true; return; }
  // (last, before a first set counts as taken: the first draws of what the room adds to the world's pass — again next
  //  frame while a program of theirs is still linking)
  // (on the top tier inside the frame's own passes — core/interiors.js NO_WARMPASS: asked for here, drawn in
  //  afterWorld / afterComposite; a frame that drew nothing leaves it standing, and it is then drawn here as before)
  if (S.wwPending) {
    if (I._deferOK && I._deferOK() && I._wwPend !== d && !I._wwCv) { I._wwPend = d; return; }
    if (I._wwPend === d) I._wwPend = null;
    if (warmWorld(I, d) || ++S.wwTries > 600) { S.wwPending = false; S.impDone = true; } return;
  }
  // (a picture is never waited for either — core/_lazylink.js: a step in which a draw was left out because its program
  //  is still linking is taken again next frame)
  const LL = R.linkWait || null, sk0 = LL ? LL.skipped : 0, lazy = !!LL && LL.on && (S.impTries || 0) < 600; if (lazy) LL.force++;
  const hid = I._hid || (I._hid = []); hid.length = 0;
  d.scene.traverse((o) => { if (o.visible && ((o.name === 'character' && !o.isMesh) || o.userData.view || o.userData.noImpostor)) { o.visible = false; hid.push(o); } });
  for (const D of d.doorList) if (D.portalRef && D.group.visible) { D.group.visible = false; hid.push(D.group); }
  const prt = R.getRenderTarget(), ac = R.autoClear, ca = R.getClearAlpha(), col = R.getClearColor(I._cc || (I._cc = new THREE.Color())), sm = R.shadowMap.autoUpdate, smN = R.shadowMap.needsUpdate;
  const step = S.steps[S.impFace], last = S.impFace === S.steps.length - 1;
  const draw = (cam, t) => {      // (the tile and its gutter cleared, then the picture)
    A.viewport.set(t[0], t[1], t[2], t[3]); A.scissor.set(t[0] - GUT + 1, t[1] - GUT + 1, t[2] + 2 * GUT - 2, t[3] + 2 * GUT - 2); A.scissorTest = true;
    R.setRenderTarget(A); R.clear(true, true, false); A.scissor.set(t[0], t[1], t[2], t[3]); R.setRenderTarget(A);
    // (a picture in the room's own frame: not lifted - world/terrain.js ROOM PASSES)
    const W = I.game.world, st = W && W.terrainStill; if (st) st(true); try { R.render(d.scene, cam); } finally { if (st) st(false); }
  };
  try {
    R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false; R.setClearColor(0x000000, 0); R.autoClear = false;
    A.texture.generateMipmaps = last;
    if (step.c) {
      const c = step.c, F = FACES[step.f], pc = I._pcam || (I._pcam = new THREE.PerspectiveCamera(90, 1, 0.06, 400)), N = c.cube[2];
      pc.position.copy(c.pos); pc.up.set(F[3], F[4], F[5]); pc.lookAt(c.pos.x + F[0], c.pos.y + F[1], c.pos.z + F[2]); pc.updateMatrixWorld(true);
      draw(pc, [c.cube[0] + (step.f % 3) * (N + 2 * GUT), c.cube[1] + Math.floor(step.f / 3) * (N + 2 * GUT), N, N]);
    } else {
      // tiles: straight on from outside, through the thickness of the wall and a hand's breadth beyond
      const oc = I._ortho || (I._ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
      for (const T of step.tiles) {
        const op = T.op, o = op.o, h = op.y1 - op.y0, DS = T.shut ? o.doors || [] : [];
        for (const D of DS) { D.group.visible = true; if (D.kind === 'hinged') { D._ry = D.group.rotation.y; D.group.rotation.y = D.o.dir; } else { D._sl = D.slide; D.slide = 0; D._place(); } }
        oc.left = -op.w / 2; oc.right = op.w / 2; oc.bottom = -h / 2; oc.top = h / 2; oc.near = 0; oc.far = op.k + 0.05 + (o.slab ?? (op.cell ? op.cell.inset : 0.22)); oc.updateProjectionMatrix();
        oc.position.set(o.at[0] + o.dx * (op.k + 0.05), (op.y0 + op.y1) / 2, o.at[1] + o.dz * (op.k + 0.05)); oc.up.set(0, 1, 0); oc.lookAt(o.at[0], (op.y0 + op.y1) / 2, o.at[1]); oc.updateMatrixWorld(true);
        try { draw(oc, T.t); } finally { for (const D of DS) { D.group.visible = false; if (D.kind === 'hinged') D.group.rotation.y = D._ry; else { D.slide = D._sl; D._place(); } } }
      }
    }
  } catch (e) { if (!I._impErr) console.warn('[interiors] impostor draw', d.id, e); I._impErr = true; S.impOK = false; }
  finally {
    A.texture.generateMipmaps = true; A.scissorTest = false;
    R.setRenderTarget(prt); R.setClearColor(col, ca); R.autoClear = ac; R.shadowMap.autoUpdate = sm; R.shadowMap.needsUpdate = smN;
    for (const o of hid) o.visible = true;
    if (lazy) LL.force--;
  }
  if (lazy && LL.skipped > sk0) { S.impTries = (S.impTries || 0) + 1; return; }
  S.impTries = 0; S.impFace++; I.stats.cubeFaces++;
  if (S.impFace >= S.steps.length) { S.impFace = 0; S.impAge = 0; S.impBusy = false; S.impTries = 0; if (!S.impDone) { S.wwPending = true; S.wwTries = 0; } }
}

/** first draws of what this room adds to the WORLD's pass (opening quads, impostors, door-leaf proxies) and of its
 *  cross-fade quad: into one pixel, off the picture, so nothing links or uploads when the room is first shown */
export function warmWorld(I, d, ph = 0) {      // (ph 1: the post target's half, in the world's pass; ph 2: the canvas's half, after the composite; both off the picture)
  const S = d.sl, g = I.game, R = g.renderer;
  if (!R || !R.render || !R.setViewport || !R.getViewport || !R.setScissor || !R.getPixelRatio || !g.worldScene) return true;
  const cam = I.camWarm || (I.camWarm = new THREE.PerspectiveCamera(60, 1, 0.1, 200)); cam.layers.set(WARM);
  const list = [...S.wm, ...S.proxies.map((e) => e.mesh)], room = []; if (S.mBlend) room.push(S.mBlend); if (S.mExp) room.push(S.mExp); if (S.cap) room.push(S.cap); if (S.mTile) { if (!S.mTile.parent) { d.scene.add(S.mTile); S.mTile.visible = false; S.mTile.userData.view = true; S.mTile.userData.noSplit = true; } room.push(S.mTile); }
  const st = [], geos = new Set();
  for (const m of [...list, ...room]) { st.push(m.visible, m.frustumCulled); m.visible = true; m.frustumCulled = false; m.layers.enable(WARM); if (m.geometry.index && m.geometry.drawRange.count === 0 && m.geometry.attributes.aFade) geos.add(m.geometry); }
  for (const q of geos) q.setDrawRange(0, 6);
  const pr = R.getPixelRatio() || 1, vp = R.getViewport(I._vp), sc = R.getScissor ? R.getScissor(I._sc) : null, sct = R.getScissorTest ? R.getScissorTest() : false, ac = R.autoClear, rt = R.getRenderTarget ? R.getRenderTarget() : null, sm = R.shadowMap.autoUpdate, smN = R.shadowMap.needsUpdate;
  const rv = S.proxyRoot ? S.proxyRoot.visible : true; if (S.proxyRoot) S.proxyRoot.visible = true;
  const LL = R.linkWait || null, sk0 = LL ? LL.skipped : 0, lazy = !!LL && LL.on && (S.wwTries || 0) < 600; if (lazy) LL.force++;
  try {
    if (rt && ph === 0) R.setRenderTarget(null);
    if (ph !== 1) { R.setViewport(ph === 2 ? -4 / pr : 0, ph === 2 ? -4 / pr : 0, 1.01 / pr, 1.01 / pr); R.setScissor(0, 0, 1.01 / pr, 1.01 / pr); R.setScissorTest(true); }
    R.autoClear = false; R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false;
    // (the target the world's pass is really drawn into: the post pass's own on a tier that has one, else the screen;
    //  the room's own view meshes in both — the camera may be in the room or outdoors)
    const inT = !!(I._postTarget && I._postTarget());
    if (ph === 1) { if (list.length) I._warmInTarget(R, g.worldScene, cam, true); if (room.length) I._warmInTarget(R, d.scene, cam, true); }
    else if (ph === 2) { if (room.length) R.render(d.scene, cam); }
    else {
    if (list.length) { if (inT) I._warmInTarget(R, g.worldScene, cam); else R.render(g.worldScene, cam); }      // (none of these is lit: the world's lights need not be on this layer)
    if (room.length) { R.render(d.scene, cam); if (inT) I._warmInTarget(R, d.scene, cam); }
    }
    I.stats.warmDraws += list.length + room.length;
  } catch (e) { if (!I._warmErr) console.warn('[interiors] warm (world side)', d.id, e); I._warmErr = true; }
  finally {
    if (lazy) LL.force--;
    R.autoClear = ac; R.setViewport(vp); if (sc) R.setScissor(sc); R.setScissorTest(sct); if (rt) R.setRenderTarget(rt); R.shadowMap.autoUpdate = sm; R.shadowMap.needsUpdate = smN;
    let i = 0; for (const m of [...list, ...room]) { m.visible = st[i++]; m.frustumCulled = st[i++]; m.layers.disable(WARM); }
    for (const q of geos) q.setDrawRange(0, 0);
    if (S.proxyRoot) S.proxyRoot.visible = rv;
  }
  return !(lazy && LL.skipped > sk0);
}

/** rebuild the index of every mesh of the room's openings from the ops' kinds */
export function reindex(I, d) {
  const S = d.sl, soft = I._soft, on = !!S.shown; let n;
  if (S.gMark) {
    n = setIdx(S.gMark, S, M_MARK); S.punchMark.visible = on && !soft && n > 0;
    n = setIdx(S.gReset, S, M_RESET); S.punch.visible = on && !soft && n > 0; S.punchSoft.visible = on && soft && n > 0;
  }
  if (S.gImp) {
    n = setIdx(S.gImp, S, 1 << K_IMP); S.mImp.visible = on && n > 0;
    n = setIdx(S.gDoor, S, M_CUBE); S.mDoor.visible = on && !soft && n > 0; S.mSoft.visible = on && soft && n > 0;
    n = setIdx(S.gTile, S, 1 << K_PIMP); S.hasPeople = on && n > 0;
    n = setIdx(S.gBlend, S, 1 << K_BLEND); S.mBlend.visible = on && n > 0;
  }
  if (S.proxies) for (const e of S.proxies) { e.on = on && (e.op.kind === K_DIMP || e.op.kind === K_BLEND); if (!e.on) e.mesh.visible = false; }
  S.softKey = soft;
}
/** the room is no longer shown: nothing of it in the world's pass */
export function hideView(I, d) {
  const S = d.sl; if (!S.ops) return;
  for (const op of S.ops) op.kind = K_NONE;
  reindex(I, d); S.hasReal = false; S.hasPeople = false;
}

/**
 * Give every op of room d its kind for this frame. cam: the frame's camera in the ROOM's coordinates.
 * mode 0: the camera is outdoors on foot (REAL allowed); 1: impostors only (in a vehicle; the camera is inside another
 * room); 2: the camera is inside this room (its other openings that face the eye — another wing's — are impostors).
 * Returns true when the room has REAL openings on screen: their screen rectangle is left in S.rr (NDC).
 */
export function classify(I, d, cam, mode) {
  const S = d.sl, ops = S.ops, g = I.game, p = g.player, soft = I._soft;
  const N = S.near || (S.light ? NEAR_L : NEAR)[tierName(g)] || NEAR.medium, n0 = N[0] * (I.nearK ?? 1), n1 = N[1] * (I.nearK ?? 1), people = mode === 0 && S.peopleN > 0 && !I.noPeople;
  const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, imp = S.impOK && S.impDone && !I.noImpostor, pR = PEOPLE_RT[tierName(g)] || PEOPLE_R;
  let px, py, pz;
  if (p.place === d.id) { px = p.pos.x; py = p.pos.y; pz = p.pos.z; } else { const w = p.place === 'world' || !p.worldPos ? p.pos : p.worldPos, l = S.toLocal(w.x, w.z, _l); px = l[0]; pz = l[1]; py = w.y - S.base(); }
  py += 1.3;
  let changed = S.softKey !== soft, fade = false, seen = false, real = false, x0 = 1, y0 = 1, x1 = -1, y1 = -1, pany = false, p0 = 1, q0 = 1, p1 = -1, q1 = -1;
  I._proj(cam);
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i], o = op.o;
    const rx = cx - o.at[0], rz = cz - o.at[1], side = rx * o.dx + rz * o.dz;
    if (op.qi < 0) {      // (an opening the shell models itself — no quad, nothing to paint a picture on: the room, whenever it is in view)
      if (mode === 0 && side > 0.02 && rx * rx + rz * rz < 3600) { const door = op.portal ? o.door || null : null; if (I._boxRect(o, op.portal ? op.w + 0.2 : op.w, op.y0, op.portal ? op.y1 + 0.1 : op.y1, door && door.kind === 'hinged' ? door.o.w : 0)) { const b = I._b; real = true; if (b[0] < x0) x0 = b[0]; if (b[1] < y0) y0 = b[1]; if (b[2] > x1) x1 = b[2]; if (b[3] > y1) y1 = b[3]; } }
      continue;
    }
    let kind = K_NONE, a = 0;
    if (side > 0.02) {
      const hw = op.w / 2, lat = Math.max(-hw, Math.min(hw, rx * o.tx + rz * o.tz)), ex = rx - o.tx * lat, ez = rz - o.tz * lat, ey = cy - Math.max(op.y0, Math.min(op.y1, cy)), dC = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (dC < FAR1) {
        // (a doorway may have a pair of leaves: closed = all of them; glazed = any of them)
        const door = op.portal ? o.door || null : null; let closed = !!door, glazed = false, leaf = false;
        if (door) { const DS = o.doors; for (let j = 0; j < DS.length; j++) { const D = DS[j]; if (!(D.open < 0.004) || D.target > 0) closed = false; if (D.glazed) glazed = true; if (D.proxies && D.proxies.length) leaf = true; } }
        const shut = closed && !glazed;
        const has = imp && !!op.cell;
        if (has && op.tile2) setTile(S, op, closed);
        let f = 1;
        if (mode === 0) {
          const qx = px - o.at[0], qz = pz - o.at[1], l2 = Math.max(-hw, Math.min(hw, qx * o.tx + qz * o.tz)), fx = qx - o.tx * l2, fz = qz - o.tz * l2, fy = py - Math.max(op.y0, Math.min(op.y1, py)), dP = Math.sqrt(fx * fx + fy * fy + fz * fz);
          const de = dC < dP ? dC : dP;
          if (!has) f = 0; else if (de <= n0) f = 0; else if (de < n1) { const t = (de - n0) / (n1 - n0); f = t * t * (3 - 2 * t); }
        }
        if (has && shut && op.tile2) f = 1;      // (a shut solid door is its picture, however near)
        // (a target with no stencil buffer — the post pass's own has one now, world/post.js: the one-pass hole does not
        //  hold on the target machine's GPU, the shell's painted front showed instead of the room; there a room is its
        //  picture until you are in it)
        if (has && soft) f = 1;
        if (f >= 1) {
          if (!has) kind = K_NONE;      // (no impostor to show: the painted shell)
          else if (leaf && !closed && !soft && dC < FAR0) kind = K_DIMP;      // (a leaf moving or standing open: the leaf itself before the cube)
          else if (people && !soft && dC < pR && !(shut && op.tile2)) { kind = K_PIMP; a = 1; seen = true; }      // (people in the room: they are drawn for real in it)
          else { kind = K_IMP; a = dC <= FAR0 ? 1 : (FAR1 - dC) / (FAR1 - FAR0); seen = true; }
        } else if (f > 0) { kind = K_BLEND; a = f; } else kind = K_REAL;
      }
    }
    if (kind !== op.kind) { op.kind = kind; changed = true; }
    if (a !== op.a) { op.a = a; const F = S.pFade.array, b = op.qi * 6; F[b] = F[b + 1] = F[b + 2] = F[b + 3] = F[b + 4] = F[b + 5] = a; fade = true; }
    if (kind === K_REAL || kind === K_BLEND) {
      const door = op.portal ? o.door || null : null;
      if (I._boxRect(o, op.portal ? op.w + 0.2 : op.w, op.y0, op.portal ? op.y1 + 0.1 : op.y1, door && door.kind === 'hinged' ? door.o.w : 0)) { const b = I._b; real = true; if (b[0] < x0) x0 = b[0]; if (b[1] < y0) y0 = b[1]; if (b[2] > x1) x1 = b[2]; if (b[3] > y1) y1 = b[3]; }
    }
    else if (kind === K_PIMP && I._boxRect(o, op.w, op.y0, op.y1, 0)) { const b = I._b; pany = true; if (b[0] < p0) p0 = b[0]; if (b[1] < q0) q0 = b[1]; if (b[2] > p1) p1 = b[2]; if (b[3] > q1) q1 = b[3]; }
  }
  // (the part of the screen the people of this room can be seen in: its PIMP openings)
  S.pOn = pany; if (pany) { const r = S.pr || (S.pr = { x0: 0, y0: 0, x1: 0, y1: 0 }); r.x0 = Math.max(-1, p0); r.y0 = Math.max(-1, q0); r.x1 = Math.min(1, p1); r.y1 = Math.min(1, q1); }
  if (fade) S.pFade.needsUpdate = true;
  if (changed) reindex(I, d);
  if (seen) S.impSeen = true;
  S.hasReal = real;
  if (real) { const r = S.rr || (S.rr = { x0: 0, y0: 0, x1: 0, y1: 0 }); r.x0 = Math.max(-1, x0); r.y0 = Math.max(-1, y0); r.x1 = Math.min(1, x1); r.y1 = Math.min(1, y1); }
  return real;
}

/** door-leaf proxies follow their leaves (only when a leaf has moved) */
export function syncProxies(S) {
  const L = S.proxies; if (!L || !L.length || !S.mw) return;
  const all = S.proxyDirty; S.proxyDirty = false;
  for (let i = 0; i < L.length; i++) {
    const e = L[i], D = e.door, sl = D.slide || 0;
    { let v = !!e.on; for (let o = e.src; v && o && o !== D.group.parent; o = o.parent) if (!o.visible) v = false; if (e.mesh.visible !== v) e.mesh.visible = v; }      // (a hidden part of the leaf — a "Closed" card — is hidden here too)
    if (!all && e.th === D.th && e.sl === sl) continue;
    if (i === 0 || L[i - 1].door !== D) D.group.updateMatrixWorld(true);
    e.th = D.th; e.sl = sl;
    e.mesh.matrix.multiplyMatrices(S.mw, e.src.matrixWorld); e.mesh.matrixWorld.copy(e.mesh.matrix); e.mesh.matrixWorldNeedsUpdate = false;
  }
}
/** the real leaves that are being drawn as proxies are left out of the room's pass from outside (v = false), and put back */
export function showLeaves(S, v) { const L = S.proxies; if (L) for (let i = 0; i < L.length; i++) if (L[i].op.kind === K_BLEND) L[i].src.visible = v; }
