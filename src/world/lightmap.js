// The light map (graphics pass 9): local light that really lights things — street lamps, lit shopfronts spilling on
// the pavement, headlights sweeping walls and walkers — for the cost of ONE texture fetch in every lit material.
//
// three's forward lights cannot do it: a point light is a loop iteration in every lit pixel of every material, and the
// city has ~3000 lamps (the world keeps a pool of 4 real PointLights on the nearest lamps for their specular streak on
// wet tarmac, and that is all it can afford). Instead the light arriving near the ground is drawn top-down into a small
// texture round the camera (256 x 256 texels over 192 m, half float): every source is a soft additive blob — a round
// pool under a lamp, a strip in front of a lit shopfront, an ellipse ahead of a vehicle's headlamps. The lit materials
// sample it by world x, z in the lights chunk and add it to their irradiance, fading with height (walls are lit to
// first-floor height, towers stay dark) and a little by facing (ground full, walls about half). So lamplight is
// multiplied by the surface's own colour — paving shows its joints, a red bus is red under a lamp, a walker is lit as
// they pass a shop window — which the old additive pools on the ground could not do.
//   cost      2 draws into the 256² target a frame while it is night (static sources: one instanced draw, rebuilt only
//             when the camera has moved 24 m; moving sources: one instanced draw, refilled every frame), nothing by
//             day (the strength uniform is 0 and the materials skip the fetch); one fetch + ~8 instructions per lit pixel
//   stable    the texture's centre snaps to its own texel grid, so static light never shimmers as the camera moves
//   walls     (2026-11-24, "lighting and buildings") a pool STOPS AT A WALL. Each static source — lamp post, wall lantern,
//             lit shopfront — looks round itself once, the first time it comes within reach: 32 lines out to its rim
//             against the world collider's walls (buildings, and walls of 2.5 m or more; an archway or an open doorway
//             — collider passages — lets the line through; the first 0.3 m is not looked at, so a lantern whose point
//             lies ON or just inside its wall is not shut in by it). The 32 distances ride with the instance (8 normalised
//             byte attributes) and the pool's pixel shader cuts the pool where its own direction's distance ends, the
//             edge softened over 0.3 m. So a lamp in the street no longer lights the lawn of the quad behind the
//             range, and a lantern in a hall no longer lights the path outside it. Cost: nothing per frame (the same
//             one instanced draw); the look-round is ~0.05 ms a source, at most FAN_BUDGET new ones a frame, kept for
//             good. The lit materials read the map 0.9 m out along their normal, so a wall is lit by the pool in front
//             of it and not by what lies behind it. Moving sources (headlamps, lit rooms' beams) are not cut.
//             `?lampwalls=0` off (A/B).
// The uniforms ride in ShaderLib like the cloud shadows' (clouds.js); the sampler is shared by reference through a
// wrapper on UniformsUtils.clone (three would clone or drop a texture uniform).
// LIT ROOMS (2026-11): the light of a walk-in room that is lit (core/interiors.js: a real room behind real windows and
// doors) falls out of its ground-floor windows, its glazed doors and its solid doors as far as they stand open: a
// beam from each opening, its width, widening and fading over a few metres — the pool of light at a lit doorway, the
// wash across a quad from a hall's windows. Until now a lit room was a bright picture in a black wall: nothing it
// lit reached the ground or the walls opposite, and a court with no street lamp in it (a college quad) had no local
// light at all after dark. No draws added: they are more instances of the moving sources' one draw. (What a PLACE
// does for light after dark: world.addLampGlow(x, y, z) for a wall lantern, world.addLamp(x, z) for a lamp post — both
// are pools here; a walk-in room lights its own surroundings by being lit.)
// API (world.lightmap): setEnabled(on), update(dt, night), setShops(buildingRecs), sources [fn(add)] for other
// systems' moving lights (add(x, z, dirX, dirZ, halfLen, halfWid, r, g, b)), stats. BEAMS: vehicle headlamp meshes
// (systems/_vehiclemeshes.js registers each one it builds).
import * as THREE from 'three';

export const LMAP = { A: new Float32Array([0, 0, 1 / 192, 0]), tex: { value: null },
  /** lit rooms: strength at a doorway, at a window (the beam's own peak is about 4.5 times this), and the light's colour (linear) */
  room: { door: 0.42, window: 0.3, col: [1.0, 0.8, 0.56], max: 72 },
  /** pools stop at walls (`?lampwalls=0` off; after changing it at run time: world.lightmap.forgetWalls()) */
  walls: true };
try { if (new URLSearchParams(location.search).get('lampwalls') === '0') LMAP.walls = false; } catch (e) { /* no location */ }
/** every vehicle's headlamp beam mesh (visible = lamps on): read each frame for the moving lights */
export const BEAMS = [];
const RAYS = 32, FAN_SKIP = 0.3, FAN_PAST = 0.35, FAN_BUDGET = 8, FULL = new Uint8Array(RAYS).fill(255);
const SIZE = 256, EXTENT = 192, REBUILD = 24, MAXS = 640, MAXD = 176;      // (MAXD: headlamps and other systems' beams, and up to LMAP.room.max openings of lit rooms)

export function installLightmapChunk() {
  const C = THREE.ShaderChunk;
  if (C.__gtoLmap) return; C.__gtoLmap = true;
  C.lights_pars_begin = C.lights_pars_begin + /* glsl */`
uniform sampler2D gtoLmap;
uniform vec4 gtoLmA;
`;
  C.lights_fragment_end = /* glsl */`
#if defined( RE_IndirectDiffuse )
if (gtoLmA.w > 0.0) {
	vec3 gtoLw = cameraPosition + geometryPosition * mat3(viewMatrix);
	float gtoLh = max(gtoLw.y - 2.0, 0.0) * 0.17;
	vec3 gtoLn3 = geometryNormal * mat3(viewMatrix);
	float gtoLn = gtoLn3.y;
	// (read a little way out along the normal: a wall takes the light of the ground in front of it, on its own side)
	irradiance += texture2D(gtoLmap, (gtoLw.xz + gtoLn3.xz * 0.9 - gtoLmA.xy) * gtoLmA.z + 0.5).rgb * (gtoLmA.w * (0.5 + 0.5 * max(gtoLn, 0.0)) / (1.0 + gtoLh * gtoLh));
}
#endif
` + C.lights_fragment_end;
  for (const k in THREE.ShaderLib) { const u = THREE.ShaderLib[k].uniforms; if (u && (u.directionalLights || u.ambientLightColor)) { u.gtoLmA = { value: LMAP.A }; u.gtoLmap = LMAP.tex; } }
  THREE.UniformsLib.lights.gtoLmA = { value: LMAP.A }; THREE.UniformsLib.lights.gtoLmap = { value: null };
  // the sampler uniform is ONE object shared by every material (so pointing it at the target reaches them all)
  const UU = THREE.UniformsUtils, clone = UU.clone;
  UU.clone = (src) => {
    if (!src || src.gtoLmap !== LMAP.tex) return clone(src);
    const tmp = { ...src }; delete tmp.gtoLmap;
    const out = clone(tmp); out.gtoLmap = LMAP.tex;
    return out;
  };
}

const VS = /* glsl */`
attribute vec4 aI;    // centre x, z, half length, half width
attribute vec4 aD;    // direction x, z (unit), gate (>= 0: on when night passes it, < 0: always), shape (0 round, 1 beam)
attribute vec3 aC;    // colour x strength
attribute vec4 aR0; attribute vec4 aR1; attribute vec4 aR2; attribute vec4 aR3; attribute vec4 aR4; attribute vec4 aR5; attribute vec4 aR6; attribute vec4 aR7;   // how far the pool reaches along each of 32 directions, 0..1 of its rim (walls)
uniform vec4 uMap;    // centre x, z, 2 / extent, night
varying vec3 vL; varying vec3 vC; varying vec2 vN;
varying vec4 vR0; varying vec4 vR1; varying vec4 vR2; varying vec4 vR3; varying vec4 vR4; varying vec4 vR5; varying vec4 vR6; varying vec4 vR7;
void main() {
  vec2 w = aI.xy + aD.xy * (position.x * aI.z) + vec2(-aD.y, aD.x) * (position.y * aI.w);
  vec2 n = (w - uMap.xy) * uMap.z;
  float k = aD.z >= 0.0 ? smoothstep(aD.z, aD.z + 0.05, uMap.w) : 1.0;
  vL = vec3(position.xy, aD.w); vC = aC * k; vN = n;
  vR0 = aR0; vR1 = aR1; vR2 = aR2; vR3 = aR3; vR4 = aR4; vR5 = aR5; vR6 = aR6; vR7 = aR7;
  gl_Position = vec4(n.x, n.y, 0.0, 1.0);
}`;
const FS = /* glsl */`
varying vec3 vL; varying vec3 vC; varying vec2 vN;
varying vec4 vR0; varying vec4 vR1; varying vec4 vR2; varying vec4 vR3; varying vec4 vR4; varying vec4 vR5; varying vec4 vR6; varying vec4 vR7;
float reach(int i) {
  int q = i >> 2; vec4 v = q < 4 ? (q < 2 ? (q == 0 ? vR0 : vR1) : (q == 2 ? vR2 : vR3)) : (q < 6 ? (q == 4 ? vR4 : vR5) : (q == 6 ? vR6 : vR7));
  int c = i & 3; return c == 0 ? v.x : c == 1 ? v.y : c == 2 ? v.z : v.w;
}
void main() {
  float f;
  if (vL.z < 0.5) {
    // a pool: a bright core and a long soft tail, exactly zero at the rim
    float r2 = dot(vL.xy, vL.xy), e = max(1.0 - r2, 0.0);
    f = e * e / (1.0 + 5.0 * r2);
    // ...and it stops at a wall: the reach along this pixel's own direction, between the two nearest of the 32 lines
    float a = atan(vL.y, vL.x) * 5.0929582; a = a < 0.0 ? a + 32.0 : a;
    int i0 = int(a) & 31;
    float lim = mix(reach(i0), reach((i0 + 1) & 31), fract(a));
    f *= 1.0 - smoothstep(lim - 0.02, lim + 0.012, sqrt(r2)) * step(lim, 0.998);
  } else {
    // a beam: from the lamps at x = -1, widening and fading to nothing at x = 1
    float u = vL.x * 0.5 + 0.5, wd = 0.22 + 0.78 * u, y = vL.y / wd;
    float e = max(1.0 - y * y, 0.0);
    f = e * e * smoothstep(0.0, 0.06, u) * (1.0 - u) * (1.0 - u) / wd;
  }
  // nothing at the edge of the map (a sample outside it clamps to the edge texel)
  float edge = 1.0 - smoothstep(0.82, 0.97, max(abs(vN.x), abs(vN.y)));
  gl_FragColor = vec4(vC * f * edge, 1.0);
}`;

export function createLightmap(game) {
  const R = game.renderer;
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  LMAP.tex.value = black;
  const st = { enabled: false, drawn: false, statics: 0, dynamics: 0, rebuilds: 0, lamps: 0, shops: 0, rooms: 0, ms: 0, fans: 0, cut: 0, pending: 0 };
  let rt = null, on = false, bx = 1e9, bz = 1e9, lastNight = -1, dirty = true, age = 0;
  const can = !!(R && R.setRenderTarget && R.getRenderTarget && R.getContext);     // (a stub renderer in the node tests: data only)
  const mat = new THREE.ShaderMaterial({
    name: 'world:lightmap', uniforms: { uMap: { value: new THREE.Vector4() } }, vertexShader: VS, fragmentShader: FS,
    depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, toneMapped: false, fog: false, side: THREE.DoubleSide,
  });
  const mkMesh = (cap) => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const aI = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), aD = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), aC = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    aI.setUsage(THREE.DynamicDrawUsage); aD.setUsage(THREE.DynamicDrawUsage); aC.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aI', aI); g.setAttribute('aD', aD); g.setAttribute('aC', aC);
    // the 32 reaches, as 8 x 4 normalised bytes in ONE interleaved buffer (255 = to the rim)
    const rb = new THREE.InstancedInterleavedBuffer(new Uint8Array(cap * RAYS).fill(255), RAYS, 1); rb.setUsage(THREE.DynamicDrawUsage);
    for (let k = 0; k < 8; k++) g.setAttribute('aR' + k, new THREE.InterleavedBufferAttribute(rb, 4, k * 4, true));
    g.instanceCount = 0;
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.matrixAutoUpdate = false;
    return { m, g, aI, aD, aC, rb, rDirty: false, n: 0, cap };
  };
  const S = mkMesh(MAXS), D = mkMesh(MAXD);
  const scene = new THREE.Scene(); scene.add(S.m); scene.add(D.m); scene.matrixWorldAutoUpdate = false;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const put = (T, x, z, dx, dz, hl, hw, gate, shape, r, g, b, reach = null) => {
    if (T.n >= T.cap) return false;
    const i = T.n++, I = T.aI.array, Dd = T.aD.array, Cc = T.aC.array;
    if (reach) { T.rb.array.set(reach, i * RAYS); T.rDirty = true; }
    I[i * 4] = x; I[i * 4 + 1] = z; I[i * 4 + 2] = hl; I[i * 4 + 3] = hw;
    Dd[i * 4] = dx; Dd[i * 4 + 1] = dz; Dd[i * 4 + 2] = gate; Dd[i * 4 + 3] = shape;
    Cc[i * 3] = r; Cc[i * 3 + 1] = g; Cc[i * 3 + 2] = b;
    return true;
  };
  const flush = (T) => { T.g.instanceCount = T.n; T.m.visible = T.n > 0; if (T.n) { for (const a of [T.aI, T.aD, T.aC]) { a.clearUpdateRanges(); a.addUpdateRange(0, T.n * a.itemSize); a.needsUpdate = true; } if (T.rDirty) { T.rDirty = false; T.rb.clearUpdateRanges(); T.rb.addUpdateRange(0, T.n * RAYS); T.rb.needsUpdate = true; } } };

  // ---- walls: how far a static source's pool reaches along each of RAYS directions (0..255 of its rim), looked up once
  const near = [];
  let fanLeft = 0;
  const blocks = (s) => { if (s.tag === 'building') return true; const h = s.h ?? s.sh; return h >= 2.5 || (h === undefined && s.top === undefined && (s.tag === 'wall' || s.tag === 'city_wall')); };
  /** the reaches of a pool at (x, z), direction (dx, dz), half length / width hl, hw: a Uint8Array(RAYS), FULL if nothing is in the way, null if there is no budget left this frame */
  function fan(x, z, dx, dz, hl, hw) {
    const col = game.worldCollider;
    if (!LMAP.walls || !col || !col._near) return FULL;
    if (fanLeft <= 0) return null;
    fanLeft--; st.fans++;
    const R = Math.max(hl, hw); near.length = 0;
    col._near(x - R, z - R, x + R, z + R, (s) => { if (s.seg && !s.low && blocks(s)) near.push(s); });
    if (!near.length) return FULL;
    const pass = col.passages && col.passages.length > 0 && col.inPassage;
    let out = null;
    for (let k = 0; k < RAYS; k++) {
      const a = k * (Math.PI * 2 / RAYS), c = Math.cos(a), sn = Math.sin(a);
      // (the pool's own frame, as the vertex shader lays it out: along (dx, dz) by hl, across by hw)
      const ex = dx * c * hl - dz * sn * hw, ez = dz * c * hl + dx * sn * hw, len = Math.hypot(ex, ez) || 1e-6, t0 = FAN_SKIP / len;
      let best = 1;
      for (let i = 0; i < near.length; i++) {
        const s = near[i], sx = s.x2 - s.x1, sz = s.z2 - s.z1, den = ex * sz - ez * sx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((s.x1 - x) * sz - (s.z1 - z) * sx) / den;
        if (!(t > t0 && t < best)) continue;
        const u = ((s.x1 - x) * ez - (s.z1 - z) * ex) / den;
        if (u < 0 || u > 1) continue;
        if (pass && col.inPassage(x + ex * t, z + ez * t)) continue;
        best = t;
      }
      if (best < 1) { if (!out) { out = new Uint8Array(RAYS).fill(255); } out[k] = Math.min(254, Math.round(Math.min(1, best + FAN_PAST / len) * 255)); }
    }
    if (out) st.cut++;
    return out || FULL;
  }


  // ---- lit shopfronts: one strip per shop unit, on the pavement in front of it
  let shops = null, shopR = [];     // Float32Array [x, z, dirx, dirz, half length, strength] per unit; each unit's reaches (walls), once looked up
  const lampR = new Map();          // the same for the world's lamp-head list, by index
  function setShops(recs) {
    const out = [];
    try {
      for (const rec of recs || []) {
        const res = rec && rec.res; if (!res || !res.edges) continue;
        for (const e of res.edges) {
          const P = e.plan; if (!P || P.kind !== 'shop' || !(P.units > 0) || e.covered || !(e.len > 2)) continue;
          const dx = (e.bx - e.ax) / e.len, dz = (e.bz - e.az) / e.len, uw = e.len / P.units;
          for (let u = 0; u < P.units; u++) {
            const t = (u + 0.5) * uw, h = Math.abs(Math.sin((e.ax + t * dx) * 12.9898 + (e.az + t * dz) * 78.233) * 43758.5453) % 1;
            if (h < 0.22) continue;                                  // some shops are dark at night
            out.push(e.ax + dx * t + e.nx * 1.5, e.az + dz * t + e.nz * 1.5, dx, dz, Math.min(6, uw * 0.5 + 0.6), 0.55 + 0.6 * h);
          }
        }
      }
    } catch (e) { console.warn('[lightmap] shops', e); }
    shops = new Float32Array(out); shopR = new Array(out.length / 6).fill(null); st.shops = out.length / 6; dirty = true;
  }

  // ---- the static sources within reach of the camera
  const LAMP = { H: [1.0, 0.66, 0.33], S: [1.0, 0.38, 0.07], R: [1.0, 0.28, 0.03], _: [1.0, 0.6, 0.3] };     // (linear; streetscape's lantern colours)
  const LAMP_R = { H: 9.5, S: 14, R: 11, _: 9.5 }, LAMP_I = { H: 3.0, S: 3.7, R: 3.2, _: 2.8 };
  function rebuild(cx, cz) {
    S.n = 0; bx = cx; bz = cz; dirty = false; st.rebuilds++;
    let pending = 0; fanLeft = FAN_BUDGET;      // (sources not looked round yet for want of budget: drawn whole now, done over the next frames)
    const reach = EXTENT / 2 + REBUILD + 14, r2 = reach * reach;
    let nl = 0;
    const ss = game.streetscape, seen = ss && ss.lamps && ss.lamps.length ? new Set() : null;
    if (seen) {
      for (const l of ss.lamps) {
        seen.add(Math.round(l.hx * 4) + ',' + Math.round(l.hz * 4));
        if (l.gone || l.dark) continue;
        const dx = l.hx - cx, dz = l.hz - cz; if (dx * dx + dz * dz > r2) continue;
        const c = LAMP[l.type] || LAMP._, k = LAMP_I[l.type] || LAMP_I._, r = LAMP_R[l.type] || LAMP_R._;
        const f = l._lmR || (l._lmR = fan(l.hx, l.hz, 1, 0, r, r)); if (!f) pending++;
        if (put(S, l.hx, l.hz, 1, 0, r, r, l.on, 0, c[0] * k, c[1] * k, c[2] * k, f || FULL)) nl++;
      }
    }
    // lamps the place modules stand themselves (the world's lamp-head list), not the streetscape's
    const L = game.world && game.world.lampPositions;
    if (L) for (let i = 0; i < L.length; i += 3) {
      const x = L[i], z = L[i + 2]; if (!(x < 1e8)) continue;
      const dx = x - cx, dz = z - cz; if (dx * dx + dz * dz > r2) continue;
      if (seen && seen.has(Math.round(x * 4) + ',' + Math.round(z * 4))) continue;
      const c = LAMP._, k = LAMP_I._;
      let f = lampR.get(i); if (f && (f.x !== x || f.z !== z)) f = null;      // (a place may move or clear an entry of the list)
      if (!f) { const a = fan(x, z, 1, 0, LAMP_R._, LAMP_R._); if (a) { f = { x, z, a }; lampR.set(i, f); } else pending++; }
      if (put(S, x, z, 1, 0, LAMP_R._, LAMP_R._, 0.2 + 0.2 * (Math.abs(Math.sin(x * 3.7 + z * 1.3)) % 1), 0, c[0] * k, c[1] * k, c[2] * k, f ? f.a : FULL)) nl++;
    }
    if (shops) for (let i = 0; i < shops.length; i += 6) {
      const dx = shops[i] - cx, dz = shops[i + 1] - cz; if (dx * dx + dz * dz > r2) continue;
      const k = shops[i + 5], j = i / 6;
      const f = shopR[j] || (shopR[j] = fan(shops[i], shops[i + 1], shops[i + 2], shops[i + 3], shops[i + 4] + 1.2, 3.6)); if (!f) pending++;
      put(S, shops[i], shops[i + 1], shops[i + 2], shops[i + 3], shops[i + 4] + 1.2, 3.6, 0.3, 0, 1.0 * k, 0.74 * k, 0.5 * k, f || FULL);
    }
    // pools a place has asked for by name (addPool: the lamps of a room that is part of the world's own scene)
    for (const p of pools) {
      const dx = p.x - cx, dz = p.z - cz; if (dx * dx + dz * dz > r2) continue;
      const f = p.f || (p.f = fan(p.x, p.z, p.dx, p.dz, p.hl, p.hw)); if (!f) pending++;
      put(S, p.x, p.z, p.dx, p.dz, p.hl, p.hw, p.gate, 0, p.r, p.g, p.b, f || FULL);
    }
    st.lamps = nl; st.statics = S.n; st.pending = pending;
    if (pending) dirty = true;
    flush(S);
  }

  // ---- moving sources: headlamps (BEAMS) and whatever other systems add
  const sources = [], v3 = new THREE.Vector3();
  const addDyn = (x, z, dx, dz, hl, hw, r, g, b) => put(D, x, z, dx, dz, hl, hw, -1, 1, r, g, b);
  function dynamics(cx, cz) {
    D.n = 0;
    const r2 = (EXTENT / 2 + 20) * (EXTENT / 2 + 20);
    if (BEAMS.length > 500) { let k = 0; for (const b of BEAMS) { let o = b; while (o.parent) o = o.parent; if (o.isScene) BEAMS[k++] = b; } BEAMS.length = k; }     // (rigs thrown away: only those still in a scene are kept)
    for (let i = 0; i < BEAMS.length; i++) {
      const b = BEAMS[i]; if (!b.visible) continue;
      const e = b.matrixWorld.elements, x = e[12], z = e[14];
      const dx = x - cx, dz = z - cz; if (dx * dx + dz * dz > r2) continue;
      let o = b.parent, ok = false; for (let k = 0; k < 6 && o; k++) { if (!o.visible) break; if (o.isScene) { ok = o === game.worldScene; break; } o = o.parent; }
      if (!ok) continue;
      // the beam's +z is forward
      let fx = e[8], fz = e[10]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      const big = Math.hypot(e[0], e[2]) > 0.8, len = big ? 11 : 4.5, wid = big ? 5.2 : 2.2, k = big ? 3.4 : 1.6;
      if (!addDyn(x + fx * len, z + fz * len, fx, fz, len, wid, 1.0 * k, 0.93 * k, 0.78 * k)) break;
    }
    for (const fn of sources) { try { fn(addDyn); } catch (e) { /* a source must never break the frame */ } }
    try { roomSpill(cx, cz); } catch (e) { /* a source must never break the frame */ }
    st.dynamics = D.n;
    flush(D);
  }

  // ---- lit rooms (core/interiors.js): a beam out of every ground-floor opening of a shown walk-in room that is lit
  const _rw = [0, 0];
  /** how brightly room d is lit, 0..1: its ambient light and its lamps (looked at again once a second) */
  function roomLit(d) {
    const S = d.sl, f = game.frame || 0; let L = S._lmLit;
    if (L && f - L.f < 60 && f >= L.f) return L.k;
    if (!L) L = S._lmLit = { f: 0, k: 0 };
    let amb = 0, lamps = 0;
    for (const o of d.scene.children) { if (!o.isLight || !o.visible || (o.userData && o.userData.pad)) continue; if (o.isAmbientLight) amb += o.intensity; else if (o.isPointLight || o.isSpotLight) lamps += o.intensity; }
    L.f = f; L.k = Math.max(0, Math.min(1, (amb + 0.04 * Math.min(lamps, 12) - 0.2) / 0.3));
    return L.k;
  }
  function roomSpill(cx, cz) {
    const I = game.interiors, list = I && I.sl, P = LMAP.room; if (!list || !list.length) return;
    const reach = EXTENT / 2 + 8; let n = 0;
    for (let i = 0; i < list.length && n < P.max; i++) {
      const d = list[i], S = d.sl; if (!S || !S.shown || !S.ops || !d.scene || !S.toWorld) continue;
      if (Math.abs(S.cx - cx) > reach + S.reach || Math.abs(S.cz - cz) > reach + S.reach) continue;
      const lit = roomLit(d); if (!(lit > 0.02)) continue;
      for (let j = 0; j < S.ops.length && n < P.max; j++) {
        const op = S.ops[j], o = op.o; if (!o || o.off || o.opaque || op.y0 > 3.4) continue;      // (not a doorway into another room; not a window above the ground floor: its light does not reach the ground)
        let k = lit;
        if (op.portal) {
          // (a solid door: what comes out is what its opening lets out; a glazed one, or a doorway with no door: all of it)
          const D = o.door; if (D && !D.glazed) k *= Math.min(1, Math.max(0, D.open || 0) * 1.5);
          k *= P.door;
        } else k *= P.window / (1 + 0.35 * Math.max(0, op.y0));      // (a high sill: less of it lands near by)
        if (!(k > 0.01)) continue;
        const dep = (o.depth || 0) + 0.15, w = Math.max(0.5, op.w), h = Math.max(0.4, op.y1 - op.y0);
        S.toWorld(o.at[0] + o.dx * dep, o.at[1] + o.dz * dep, _rw);
        if (Math.abs(_rw[0] - cx) > reach || Math.abs(_rw[1] - cz) > reach) continue;
        const dx = o.dx * S.c + o.dz * S.s, dz = -o.dx * S.s + o.dz * S.c;      // (the opening's outward direction, in the world)
        const half = 1.6 + 0.9 * Math.sqrt(w * h);                              // half the beam's length: a door about 6 m, a tall window further
        // (the beam's shape is 0.22 of its full width at the opening and all of it at its far end)
        if (!addDyn(_rw[0] + dx * half, _rw[1] + dz * half, dx, dz, half, (w / 2 + 0.25) / 0.22, P.col[0] * k, P.col[1] * k, P.col[2] * k)) return;
        n++;
      }
    }
    st.rooms = n;
  }

  function ensure() {
    if (rt) return;
    rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false });
    rt.texture.name = 'world:lightmap';
  }
  const _col = new THREE.Color();
  function draw(cx, cz, night) {
    ensure();
    const prev = R.getRenderTarget(), sm = R.shadowMap.autoUpdate, smN = R.shadowMap.needsUpdate, a = R.getClearAlpha();
    R.getClearColor(_col);
    R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false;
    mat.uniforms.uMap.value.set(cx, cz, 2 / EXTENT, night);
    R.setRenderTarget(rt); R.setClearColor(0x000000, 1); R.clear(true, false, false);
    R.render(scene, cam);
    R.setRenderTarget(prev); R.setClearColor(_col, a);
    R.shadowMap.autoUpdate = sm; R.shadowMap.needsUpdate = smN;
  }

  const pools = [];
  const api = {
    stats: st, sources, texel: EXTENT / SIZE,
    /** a place's own STATIC pool of lamplight (2026-11-26): an ellipse at x, z, half length hl along (dx, dz) and half
     *  width hw, linear colour r g b at its core, lit once the night is past `gate` (0..1). Like every static source
     *  it stops at walls (see "walls" at the head), so a room's table lamps light the room and not the lane outside
     *  it; it costs one more instance of the statics' one draw. For lamps that do not move: a room built into the
     *  world's scene (not a core/interiors.js room, which lights its surroundings by being lit). */
    addPool(x, z, dx, dz, hl, hw, r, g, b, gate = 0.2) { pools.push({ x, z, dx, dz, hl, hw, r, g, b, gate, f: null }); dirty = true; },
    setShops,
    setEnabled(v) { on = !!v && can; st.enabled = on; if (!on) { LMAP.A[3] = 0; LMAP.tex.value = black; st.drawn = false; } },
    /** mark the static sources stale (a lamp knocked down, a place module's lamps added) */
    invalidate() { dirty = true; },
    /** forget what every source saw of the walls (a place has put up or taken down walls after the first look) */
    forgetWalls() { lampR.clear(); shopR.fill(null); for (const p of pools) p.f = null; const ss = game.streetscape; if (ss && ss.lamps) for (const l of ss.lamps) l._lmR = null; dirty = true; },
    /** tests: the reaches of a pool here (ignores the budget) */
    fanAt(x, z, r = 9.5) { fanLeft = 1; return fan(x, z, 1, 0, r, r); },
    /** once a frame, outdoors: (re)draw the map round the camera while there is light to draw */
    update(dt, night, force = false) {
      if (!on || !R) return;
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      const c = game.camera.position, tx = EXTENT / SIZE;
      // centre: a little ahead of the camera would waste nothing, but the chase camera turns; keep it on the camera
      const cx = Math.round(c.x / tx) * tx, cz = Math.round(c.z / tx) * tx;
      const k = night > 0.12 || force ? 1 : 0;
      if (!k) { if (LMAP.A[3] !== 0) { LMAP.A[3] = 0; LMAP.tex.value = black; st.drawn = false; } return; }
      // (rebuilt when the camera has moved, and every 3 s anyway: a lamp knocked down goes dark, a place's lamps appear)
      if (dirty || Math.hypot(cx - bx, cz - bz) > REBUILD || lastNight < 0 || (age += dt) > 3) { age = 0; rebuild(cx, cz); }
      lastNight = night;
      dynamics(cx, cz);
      draw(cx, cz, night);
      LMAP.A[0] = cx; LMAP.A[1] = cz; LMAP.A[2] = 1 / EXTENT; LMAP.A[3] = 1;
      LMAP.tex.value = rt.texture; st.drawn = true;
      st.ms = st.ms * 0.9 + ((typeof performance !== 'undefined' ? performance.now() : 0) - t0) * 0.1;
    },
    /** the loading screen: the target, both instanced draws and the program, once (so dusk compiles nothing) */
    warm() {
      if (!can) return false;
      const sn = S.n, dn = D.n;
      S.n = 0; D.n = 0; put(S, 0, 0, 1, 0, 1, 1, -1, 0, 0, 0, 0); put(D, 0, 0, 1, 0, 1, 1, -1, 1, 0, 0, 0); flush(S); flush(D);
      draw(0, 0, 1);
      S.n = sn; D.n = dn; flush(S); flush(D); dirty = true;
      return true;
    },
    get texture() { return rt ? rt.texture : null; },
  };
  return api;
}
