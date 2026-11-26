// The far crowd of the centre's busy streets (busy-streets pass, 2026-11; photo comparison item 1: Cornmarket at midday
// has ~150 people in frame, the game had 0-3).
// The ambient walkers (pedestrians.js) are full characters: each one a draw call, AI, a gait. Filling a street with them
// is beyond the frame budget of a 2016 MacBook Pro, so the people further off are drawn here instead: ONE instanced draw
// of a low-poly figure (~220 triangles: head, hair, torso, arms, legs, shoes) whose clothes, skin and hair colours come
// per instance and whose legs and arms swing in the vertex shader with the distance walked (no foot slide). As one comes
// within its tier's fade distance (+2.5 m) of the camera it moves to a second, blended draw and fades out by alpha; inside
// it, the real walkers are. No shadows. (Perf / stability audit 2026-11: the fade was 5 m wide from 8 / 10 m and without
// depth write, so several figures at a time were glass people whose far arm and leg showed through their bodies — "ghostly".
// Now 2.5 m wide from 7 / 8 m, the fading figures write depth and are drawn far to near: one at a time, briefly, and solid
// figures come about 3.5 m nearer the camera.)
// Who walks where is a pure function of the map and the shared clock:
//  - STREET_WALK (_busy.js: Cornmarket, Queen Street): the pedestrian streets end to end, each member on its own line
//    across the street (lines with nothing standing on them), so they fill the whole length and width; 14 % stand still;
//  - the rest: there-and-back routes of ~70-220 m over the pedestrians' walk graph inside CORE_STREETS (Broad Street, the
//    High near Carfax, George Street, the Covered Market's approaches...), on their own side of the pavement.
// Each starts at a hashed point and walks at its own pace; how many are out follows the hour (busyHour: none at night,
// a lunchtime peak) and the weather (game.weather.crowd). So every player sees the same crowd and nothing is sent. They
// are scenery: not knockable, not in the traffic's or the walkers' way (they are gone before anyone gets near).
// Per tier (BUSY_TIERS): members low 130 / medium 440 / high all (~550), drawn within 140 / 200 / 240 m (x
// game.quality.dist), faded out inside 14 / 8 / 7 m (low: cut there, no fading draw).
// Nobody pops (2026-11-24; tools/smoke_popin.mjs): a member comes or goes with the hour only where no player can see
// it (m.on); the far edge of the radius thins out by a dither (FAR_W); walkers go round their routes' corners and turn
// round at the ends without jumping; a figure the camera is about to reach, in the picture, is handed over to a real
// walker (as one within reach of the player is), and from a vehicle only who is in its way: the pavement's people stay.
// Cost: one draw (two while some are fading); update ~0.1-0.25 ms. ?busy=0: not built.
// game.crowd = { stats(), members, mesh, fadeMesh }
import * as THREE from 'three';
import { characterRim } from '../core/characters.js';
import { pointInPoly } from '../core/collision.js';
import { busyOn, busyTier, busyHour, CORE_STREETS, HIGH_MAX_X, CORE_BOX, STREET_WALK } from './_busy.js';
import { HAND_IN, HAND_OUT } from './_ped_solid.js';

const MAXN = 760;                      // instances (the high tier's members, and a little room)
const HAND_IN2 = HAND_IN * HAND_IN, HAND_OUT2 = HAND_OUT * HAND_OUT;
const MAXF = 64;                       // instances fading in near the camera (the second, blended draw)
const FADE_W = 2.5;                    // m over which a figure fades in beyond its tier's fade distance (was 5)
const FAR_W = 26;                      // m over which the crowd thins out to nothing at the far edge of its drawing radius (dithered, in the one opaque draw)
const TURN_W = 3;                      // m from a route's end over which a walker crosses to the other side of the pavement to come back
const GRAPH_N = 300;                   // walk-graph members (the street walkers come on top: STREET_WALK)
const STILL = 0.14;                    // share of members stood still (window shopping, chatting)
const strH = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const TAU = Math.PI * 2;
const hashU = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ------------------------------------------------------------------------------------------------ looks (sRGB hex)
const TOPS = [0x1c2433, 0x2b2b2b, 0x6b1f24, 0x2f4a6b, 0x8a8f96, 0xd8d2c4, 0x3c5a3a, 0x7a5a3a, 0xb8432e, 0x2a3f5f, 0x4a3a5a, 0xc9b28a, 0x111111, 0x5a6b7a, 0xe0e0dc, 0x8a2a4a];
const BOTS = [0x1e2430, 0x22262e, 0x3a3f4a, 0x2c3b55, 0x15171a, 0x5a4a3a, 0x4a4f58, 0x2a2a2a, 0x6a6458, 0x30384a];
const SKINS = [0xf1c8a8, 0xe8b894, 0xd9a07a, 0xc08060, 0x9a6448, 0x6e4632, 0xf4d0b8, 0xe0ac88];
const HAIRS = [0x2a1a10, 0x3b2616, 0x1a1410, 0x6a4a2a, 0xb8945a, 0x8a8a86, 0x4a2a1a, 0xc8b08a, 0x111111];

// ------------------------------------------------------------------------------------------------ the figure
/** One merged low-poly person facing +z, feet at y = 0, 1.72 m. Attributes: aPart (0 skin, 1 top, 2 bottom, 3 hair,
 *  4 shoes) and aLimb (0 body, 1 left leg, 2 right leg, 3 left arm, 4 right arm: swung about hip / shoulder). */
function figureGeometry() {
  const parts = [];
  const add = (g, part, limb, x, y, z, sx = 1, sy = 1, sz = 1) => {
    g.scale(sx, sy, sz); g.translate(x, y, z);
    const n = g.attributes.position.count;
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
    g.setAttribute('aLimb', new THREE.Float32BufferAttribute(new Float32Array(n).fill(limb), 1));
    if (g.attributes.uv) g.deleteAttribute('uv');
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, false);
  /** a six-faced block through two rectangles: [x half width, y bottom, y top, z] at each end (flat-shaded, 12 triangles) */
  const block = (a, b) => {
    const v = [[-a[0], a[1], a[3]], [a[0], a[1], a[3]], [a[0], a[2], a[3]], [-a[0], a[2], a[3]], [-b[0], b[1], b[3]], [b[0], b[1], b[3]], [b[0], b[2], b[3]], [-b[0], b[2], b[3]]];
    const pos = [];
    for (const f of [[1, 0, 3, 2], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [5, 1, 2, 6]]) for (const k of [0, 1, 2, 0, 2, 3]) pos.push(...v[f[k]]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  };
  // legs (trousers) from the hip down to the shoe, a little apart
  for (const [s, limb] of [[1, 1], [-1, 2]]) {
    add(cyl(0.075, 0.058, 0.84, 4), 2, limb, s * 0.095, 0.5, 0);
    // shoe: a heel as high as the ankle falling to a low, narrower toe, turned out a little (as the near figures' feet are)
    add(block([0.046, 0, 0.088, -0.085], [0.036, 0, 0.04, 0.2]).rotateY(s * 0.11), 4, limb, s * 0.095, 0, 0);
  }
  add(cyl(0.16, 0.15, 0.2, 6), 2, 0, 0, 0.95, 0, 1, 1, 0.72);                 // hips
  add(cyl(0.185, 0.155, 0.56, 6), 1, 0, 0, 1.31, 0, 1, 1, 0.68);             // torso (coat / top)
  for (const [s, limb] of [[1, 3], [-1, 4]]) {
    add(cyl(0.052, 0.045, 0.6, 4), 1, limb, s * 0.225, 1.25, 0);              // sleeve
    add(block([0.019, -0.026, 0.026, 0], [0.012, -0.03, 0.03, 0.165]).rotateX(Math.PI / 2 - 0.1), 0, limb, s * 0.225, 0.955, 0.004); // hand: flat, palm to the thigh, narrowing to the fingers, hanging a touch forward
  }
    add(new THREE.SphereGeometry(0.105, 6, 4), 0, 0, 0, 1.71, 0.01, 0.92, 1.08, 1);   // head
  add(new THREE.SphereGeometry(0.112, 6, 3, 0, TAU, 0, Math.PI * 0.55), 3, 0, 0, 1.73, -0.012, 0.95, 1.05, 1.02);  // hair
  // merge (positions, normals, part, limb)
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), A = new Float32Array(n), B = new Float32Array(n);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); A.set(g.attributes.aPart.array, o); B.set(g.attributes.aLimb.array, o);
    o += c; g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('aPart', new THREE.BufferAttribute(A, 1));
  geo.setAttribute('aLimb', new THREE.BufferAttribute(B, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** the crowd material: lit like the characters (standard, rough, the same rim light), colours per instance and part,
 *  limbs swung by the instance's stride phase; the fading variant (blended; depth written, so a half-faded figure hides
 *  its own far limbs) takes the instance's fade as its alpha. One program for both (blending is render state). */
function crowdMaterial(fading) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0, transparent: !!fading, depthWrite: true });
  m.name = 'crowd';
  const dith = { value: fading ? 0 : 1 };      // (the opaque draw: an instance's fade below 1 thins it out in a screen pattern - the far edge of the crowd)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = characterRim; sh.uniforms.uCrowdDith = dith;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aPart; attribute float aLimb; attribute vec4 aWalk; attribute vec3 aTop; attribute vec3 aBot; attribute vec3 aSkin; attribute vec3 aHair;
varying vec3 vCrowdCol; varying float vFade;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
	float cSw = 0.0, cPy = 0.0;
	if (aLimb > 0.5) {
		float s = sin(aWalk.x);
		cSw = (aLimb < 1.5 ? s : aLimb < 2.5 ? -s : aLimb < 3.5 ? -0.75 * s : 0.75 * s) * aWalk.z;
		cPy = aLimb < 2.5 ? 0.93 : 1.5;
		float c0 = cos(cSw), s0 = sin(cSw);
		objectNormal = vec3(objectNormal.x, objectNormal.y * c0 - objectNormal.z * s0, objectNormal.y * s0 + objectNormal.z * c0);
	}
	vCrowdCol = aPart < 0.5 ? aSkin : aPart < 1.5 ? aTop : aPart < 2.5 ? aBot : aPart < 3.5 ? aHair : vec3(0.025);
	vFade = aWalk.y;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
	if (aLimb > 0.5) {
		float c1 = cos(cSw), s1 = sin(cSw);
		vec3 q = transformed; q.y -= cPy;
		transformed = vec3(q.x, q.y * c1 - q.z * s1 + cPy, q.y * s1 + q.z * c1);
	}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uCrowdDith;\nvarying vec3 vCrowdCol; varying float vFade;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\tif (uCrowdDith > 0.5 && vFade < 0.995) { float cdN = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))); if (cdN >= vFade) discard; }')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vCrowdCol, opacity * vFade );')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\t{ float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0); totalEmissiveRadiance += uRim * diffuseColor.rgb * rimF * rimF * rimF; }');
  };
  m.customProgramCacheKey = () => 'crowdFig';
  return m;
}

// ------------------------------------------------------------------------------------------------ the system
/** one instanced draw of the figure with its own per-instance attributes (the opaque crowd, and the few fading in) */
class Layer {
  constructor(scene, base, mat, n, name) {
    const g = (this.geo = new THREE.BufferGeometry());
    for (const k of ['position', 'normal', 'aPart', 'aLimb']) g.setAttribute(k, base.attributes[k]);      // (shared buffers)
    g.boundingSphere = base.boundingSphere;
    const ia = (k) => new THREE.InstancedBufferAttribute(new Float32Array(n * k), k).setUsage(THREE.DynamicDrawUsage);
    this.aWalk = ia(4); this.aTop = ia(3); this.aBot = ia(3); this.aSkin = ia(3); this.aHair = ia(3);
    g.setAttribute('aWalk', this.aWalk); g.setAttribute('aTop', this.aTop); g.setAttribute('aBot', this.aBot); g.setAttribute('aSkin', this.aSkin); g.setAttribute('aHair', this.aHair);
    const mesh = (this.mesh = new THREE.InstancedMesh(g, mat, n));
    mesh.name = name; mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    this.n = n; this.c = 0; this.lo = n; this.hi = -1;
    this.slotOf = new Int32Array(n).fill(-1);       // which member's colours each instance slot holds
  }
  begin() { this.c = 0; this.lo = this.n; this.hi = -1; }
  /** one instance: member m at (x, y, z) facing (hx, hz), stride phase ph, fade f */
  put(m, x, y, z, hx, hz, ph, f) {
    const c = this.c; if (c >= this.n) return;
    const M = this.mesh.instanceMatrix.array, o = c * 16, sc = m.ht;
    // rotation about y to face (hx, hz), uniform scale (see Matrix4.makeRotationY: te[0]=cos, te[2]=-sin, te[8]=sin)
    M[o] = hz * sc; M[o + 1] = 0; M[o + 2] = -hx * sc; M[o + 3] = 0;
    M[o + 4] = 0; M[o + 5] = sc; M[o + 6] = 0; M[o + 7] = 0;
    M[o + 8] = hx * sc; M[o + 9] = 0; M[o + 10] = hz * sc; M[o + 11] = 0;
    M[o + 12] = x; M[o + 13] = y; M[o + 14] = z; M[o + 15] = 1;
    const W = this.aWalk.array; W[c * 4] = ph; W[c * 4 + 1] = f; W[c * 4 + 2] = m.swing; W[c * 4 + 3] = 0;
    if (this.slotOf[c] !== m.k) {      // (colours only when another member takes the slot)
      this.slotOf[c] = m.k; const c3 = c * 3; if (c < this.lo) this.lo = c; if (c > this.hi) this.hi = c;
      const AT = this.aTop.array, AB = this.aBot.array, AS = this.aSkin.array, AH = this.aHair.array;
      AT[c3] = m.top.r; AT[c3 + 1] = m.top.g; AT[c3 + 2] = m.top.b;
      AB[c3] = m.bot.r; AB[c3 + 1] = m.bot.g; AB[c3 + 2] = m.bot.b;
      AS[c3] = m.skin.r; AS[c3 + 1] = m.skin.g; AS[c3 + 2] = m.skin.b;
      AH[c3] = m.hair.r; AH[c3 + 1] = m.hair.g; AH[c3 + 2] = m.hair.b;
    }
    this.c = c + 1;
  }
  end() {
    const mesh = this.mesh, c = this.c;
    mesh.count = c; mesh.visible = c > 0;
    if (!c) return;
    mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, c * 16); mesh.instanceMatrix.needsUpdate = true;
    const W4 = this.aWalk; W4.clearUpdateRanges(); W4.addUpdateRange(0, c * 4); W4.needsUpdate = true;
    if (this.hi >= 0) for (const a of [this.aTop, this.aBot, this.aSkin, this.aHair]) { a.clearUpdateRanges(); a.addUpdateRange(this.lo * 3, (this.hi - this.lo + 1) * 3); a.needsUpdate = true; }
  }
  hide() { if (this.mesh.visible) { this.mesh.visible = false; this.mesh.count = 0; } }
}

/** One street walker's way along its street (see _build): OK = the grid of spots (1 clear, 0 something stands there, 255
 *  outside the room), LANE_NC across by ns + 1 stations; DES = where its share of the room lies at each station (m across);
 *  OFF (out) = how far from that it walks at each station. A function of its own so that it is compiled: inside the
 *  once-run _build it was interpreted, 3 ms a member. */
const LANE_CW = 0.25, LANE_HC = 36, LANE_NC = 2 * LANE_HC + 1;
function lanePath(ns, OK, DES, OFF, cost, prevC, from) {
  const BIG = 1e9, SPAN = 16, CW = LANE_CW, HC = LANE_HC, NC = LANE_NC;
  // the cheapest way along: near its own share of the room, on clear spots, moving sideways (against that share) as little as may be
  let c0 = 0, c1 = 0;
  for (let q = 0; q <= ns; q++) {
    const d = DES[q], a0 = Math.max(-HC, Math.round(d / CW) - SPAN), a1 = Math.min(HC, Math.round(d / CW) + SPAN);
    for (let c = a0; c <= a1; c++) {
      const st = OK[q * NC + c + HC], dv = c * CW - d;
      let nodeC = dv * dv + (st === 1 ? 0 : st === 0 ? 400 : 4000), best = 0, bf = 0;
      if (q) {
        best = BIG;
        for (let e = -2; e <= 2; e++) {
          const cp = c - e; if (cp < c0 || cp > c1) continue;
          const pv = prevC[cp + HC]; if (pv >= BIG) continue;
          const ch = dv - (cp * CW - DES[q - 1]), v = pv + 8 * ch * ch + (e === 2 || e === -2 ? 1.5 : 0);
          if (v < best) { best = v; bf = e; }
        }
        if (best >= BIG) { nodeC = BIG; best = 0; }
      }
      cost[c + HC] = nodeC >= BIG ? BIG : nodeC + best; from[q * NC + c + HC] = bf;
    }
    for (let c = a0; c <= a1; c++) prevC[c + HC] = cost[c + HC];
    for (let c = c0; c < a0; c++) prevC[c + HC] = BIG; for (let c = a1 + 1; c <= c1; c++) prevC[c + HC] = BIG;
    c0 = a0; c1 = a1;
  }
  let bc = c0; for (let c = c0; c <= c1; c++) if (prevC[c + HC] < prevC[bc + HC]) bc = c;
  for (let q = ns; q >= 0; q--) { OFF[q] = bc * CW - DES[q]; bc -= from[q * NC + bc + HC]; }
}

class Crowd {
  constructor(game) {
    this.game = game;
    this.members = [];
    this.built = false; this.buildMs = 0;
    this.base = figureGeometry();
    this.mat = crowdMaterial(false);
    this.matFade = crowdMaterial(true);
    this.solid = new Layer(game.worldScene, this.base, this.mat, MAXN, 'crowd:far');
    this.fading = new Layer(game.worldScene, this.base, this.matFade, MAXF, 'crowd:fade');
    this.mesh = this.solid.mesh;
    this.shown = 0; this.faded = 0; this._t = 0; this._fq = []; this._fqPool = [];
    // loading screen: build the routes (the walk graph exists by then), and draw the figure's programs once out of sight
    (game.warmups || (game.warmups = [])).push({ id: 'crowd', fn: () => {
      this._build();
      const PW = game.prewarm;
      if (PW && PW.extras && !this._warm) {
        this._warm = [];
        for (const [L, mat] of [[this.solid, this.mat], [this.fading, this.matFade]]) {
          const w = new THREE.InstancedMesh(L.geo, mat, 1); w.name = 'crowd:warm'; w.frustumCulled = false;
          w.setMatrixAt(0, new THREE.Matrix4()); L.aWalk.array[1] = 1; this._warm.push(w);
          PW.extras.push({ o: w, pre: (x, y, z) => { w.position.set(x, y - 3, z); w.updateMatrixWorld(true); return null; } });
        }
      }
      return null;
    } });
    const self = this;
    this.api = { stats: () => this.stats(), get members() { return self.members; }, mesh: this.mesh, fadeMesh: this.fading.mesh, _sys: this };
  }

  /** routes: (1) along the pedestrian streets end to end (STREET_WALK: Cornmarket, Queen Street), spread across their
   *  width; (2) there-and-back walks over the pedestrians' walk graph on the other core streets. Shuffled by a hash so a
   *  tier's first N are a fair mix of both. */
  _build() {
    if (this.built) return;
    const PS = this.game.pedestrians && this.game.pedestrians._sys, G = PS && PS.graph;
    if (!G || !G.count) return;
    // (2026-11 sanity check: the lines are laid once the streetscape's bins, benches and lamps are in the collider)
    const SS = this.game.streetscape; if (SS && !SS.ready && (this._waits = (this._waits || 0) + 1) < 30) return;
    this.built = true;
    const t0 = performance.now(), map = this.game.map, col = this.game.worldCollider;
    const gh = this.game.world && this.game.world.groundHeight ? (x, z) => this.game.world.groundHeight(x, z) : () => 0;
    // (hex: the same four colours as numbers, for the real walker who stands in for the figure within reach of the player)
    const look = (r) => { const t = TOPS[(r() * TOPS.length) | 0], b = BOTS[(r() * BOTS.length) | 0], s = SKINS[(r() * SKINS.length) | 0], h = HAIRS[(r() * HAIRS.length) | 0]; return { top: new THREE.Color(t), bot: new THREE.Color(b), skin: new THREE.Color(s), hair: new THREE.Color(h), hex: [t, b, s, h], real: null, hold: 0 }; };
    const out = [];
    // 2026-11 sanity check: figures walked through benches, bins, bus shelters, lamp posts and parked cars (the lines
    // were tested every 6 m and 8 % of misses allowed; a pavement's room at three points an edge). A line is now tested
    // every 0.7 m of its length against the collider AND what has no collider: the world's furniture and parked bikes.
    const OB = new Map(), ob = (x, z, r) => { const kk = Math.floor(x / 8) * 65536 + Math.floor(z / 8); let a = OB.get(kk); if (!a) OB.set(kk, (a = [])); a.push(x, z, r); };
    {
      const W = this.game.world, F = W && W.furniture && W.furniture.sets;
      // [radius, half length along the thing's local x (circles strung along it)]
      const FR = { bench: [0.32, 0.6], bin: [0.27, 0], postBox: [0.3, 0], busStop: [0.08, 0], shelter: [0.8, 1.2], stand: [0.15, 0.25], phone: [0.55, 0], signal: [0.1, 0], bollard: [0.1, 0], belisha: [0.08, 0], picnic: [1.0, 0] };
      if (F) for (const kind in FR) {
        const st = F[kind]; if (!st) continue; const [rr, hl] = FR[kind];
        for (let i = 0; i < st.n; i++) {
          const x = st.xz[i * 2], z = st.xz[i * 2 + 1]; if (!(Math.abs(x) < 1e8) || x < CORE_BOX.minX - 30 || x > CORE_BOX.maxX + 30 || z < CORE_BOX.minZ - 30 || z > CORE_BOX.maxZ + 30) continue;
          const yaw = Math.atan2(st.mat[i * 16 + 8], st.mat[i * 16 + 10]), ux = Math.cos(yaw), uz = -Math.sin(yaw);
          if (hl) for (const u of [-hl, 0, hl]) ob(x + ux * u, z + uz * u, rr); else ob(x, z, rr);
        }
      }
      const VS = this.game.vehicles && this.game.vehicles._sys;
      if (VS && VS.pools) VS.pools.forEach((pl) => { if (/^bike_/.test(pl.type)) for (const q of pl.slots) { const sx = Math.sin(q.h) * 0.45, sz = Math.cos(q.h) * 0.45; ob(q.x + sx, q.z + sz, 0.3); ob(q.x - sx, q.z - sz, 0.3); } });
    }
    // (inside a building: beside an archway the collider is empty - its walls are open in the passage, and there is
    // nothing in the middle of a building - so a figure two metres off the walk line went through the lodge itself)
    const BG = this.game.world && this.game.world.buildingGrid, ovr = this.game.overrides || {};
    const inBld = (x, z) => {
      if (!BG) return false; let hit = false;
      BG.queryRadius(x, z, 1, (q) => { const b = q.b; if (!b || b.part || (b.minH || 0) > 2.5 || (b.tags && b.tags.building === 'roof') || (ovr.skip && ovr.skip.has(b.id)) || (ovr.skipCollision && ovr.skipCollision.has(b.id))) return; if (pointInPoly(x, z, b.poly) && !(b.holes || []).some((h) => pointInPoly(x, z, h))) { hit = true; return true; } });
      return hit;
    };
    const blocked = (x, z, r) => {
      if (!col.isFree(x, z, r)) return true;
      if (r < 0.4 && inBld(x, z) && !(col.inPassage && col.inPassage(x, z))) return true;
      for (let cx = Math.floor((x - 2) / 8); cx <= Math.floor((x + 2) / 8); cx++) for (let cz = Math.floor((z - 2) / 8); cz <= Math.floor((z + 2) / 8); cz++) {
        const a = OB.get(cx * 65536 + cz); if (a) for (let i = 0; i < a.length; i += 3) if (Math.hypot(a[i] - x, a[i + 1] - z) < a[i + 2] + r) return true;
      }
      return false;
    };
    const member = (k, r, X, Z, S, RL, RR, fixOff, Y0 = null) => {      // (Y0: the ground under each point, where the caller has it)
      const n = X.length, Y = Y0 || new Float32Array(n);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < n; i++) { if (!Y0) Y[i] = gh(X[i], Z[i]) || 0; x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
      const pad = Math.abs(fixOff) || 3; x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
      const ht = 0.9 + r() * 0.16, still = r() < STILL, speed = still ? 0 : 1.05 + r() * 0.45;
      out.push(Object.assign({
        k, X, Z, Y, S, RL, RR, n, len: S[n - 1], x0, x1, z0, z1, speed, phase: r() * 2 * S[n - 1], side: r() * 2 - 1, gate: r(), fixOff,
        stride: 0.72 * ht + 0.12 * Math.max(0, speed - 1), ht, swing: still ? 0 : 0.32 + 0.25 * (speed - 1.05), face: r() * TAU, ord: r(),
      }, look(r)));
    };
    // ---- (1) the pedestrian streets, end to end and wall to wall
    let k = 0;
    for (const r0 of map.roads) {
      const dens = STREET_WALK[r0.name]; if (!dens || r0.kind !== 'pedestrian' || !r0.pts || r0.pts.length < 2) continue;
      const pts = r0.pts, n = pts.length, X = new Float32Array(n), Z = new Float32Array(n), S = new Float32Array(n);
      for (let i = 0; i < n; i++) { X[i] = pts[i][0]; Z[i] = pts[i][1]; if (i) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]); }
      const L = S[n - 1], half = (r0.w || 7) / 2 - 0.6, want = Math.round(L * dens);
      // 2026-11-22: wall to wall. The lines below lie within the mapped way's own 7 m and must be clear from one end of
      // the street to the other: with the benches, bins, lamps and bollard rows of a real street two were left, 25 cm
      // apart, and the whole street's crowd walked them in single file. Now each member has its own share of the room
      // there really is (the pedestrians' lanes, _ped_lanes.js: mapped paving up to 0.9 m from the shopfronts, off the
      // carriageways) and its route is its own line: stations 1.5 m apart, each a spot the near walkers' clearance rule
      // passes (0.4 m from walls, lamps, bins, benches, bike stands; not inside a building), the way round whatever
      // stands on its line found over the whole street at once (the cheapest path across a 25 cm grid of clear spots,
      // moving no more than 25 cm sideways a station where that can be had) - so no jink, and nothing walked through.
      // All of it from the member's seed and the static world: the same line on every client.
      const LN = PS.lanes;
      if (LN && L > 20) {
        const DS = 1.5, ns = Math.max(2, Math.round(L / DS)), N1 = ns + 1, CX = new Float32Array(N1), CZ = new Float32Array(N1), NX = new Float32Array(N1), NZ = new Float32Array(N1), RL = new Float32Array(N1), RR = new Float32Array(N1);
        const CW = LANE_CW, HC = LANE_HC, NC = LANE_NC;       // the grid across: 25 cm cells out to 9 m either side
        const reach = (x, z, ux, uz) => {
          const far = 9.9, t = col.raycast(x, z, x + ux * far, z + uz * far, { ignoreLow: false }), wall = t === null ? 9 : t * far - 0.9;
          let e = 0;
          for (let d = 0.25; d <= wall + 1e-6; d += 0.25) { const qx = x + ux * d, qz = z + uz * d; if ((PS.road && PS.road(qx, qz, 0.55)) || (PS.wet && PS.wet(qx, qz)) || inBld(qx, qz) || (d > half && !LN.paved(qx, qz))) break; e = d; }
          return e;
        };
        for (let j = 0, i = 0; j <= ns; j++) {
          const s = L * j / ns; while (i < n - 2 && S[i + 1] < s) i++;
          const sl = (S[i + 1] - S[i]) || 1, u = (s - S[i]) / sl;
          CX[j] = X[i] + (X[i + 1] - X[i]) * u; CZ[j] = Z[i] + (Z[i + 1] - Z[i]) * u;
        }
        for (let j = 0; j <= ns; j++) {
          // ("across" from the run of the street over 9 m, so a line far from the middle does not jump at a bend of the mapped way)
          const a = Math.max(0, j - 3), b = Math.min(ns, j + 3), dl = Math.hypot(CX[b] - CX[a], CZ[b] - CZ[a]) || 1, dx = (CX[b] - CX[a]) / dl, dz = (CZ[b] - CZ[a]) / dl;
          NX[j] = dz; NZ[j] = -dx;
          RR[j] = reach(CX[j], CZ[j], dz, -dx); RL[j] = reach(CX[j], CZ[j], -dz, dx);
        }
        // (a side street's mouth, a recess: the room is that of the narrowest spot within 6 m, so nobody swings into it;
        // and it widens or narrows by no more than 0.3 m a station, so nobody jinks where the street opens out)
        const ML = new Float32Array(N1), MR = new Float32Array(N1);
        for (let j = 0; j <= ns; j++) { let a = 99, b = 99; for (let q = Math.max(0, j - 4); q <= Math.min(ns, j + 4); q++) { if (RL[q] < a) a = RL[q]; if (RR[q] < b) b = RR[q]; } ML[j] = a; MR[j] = b; }
        for (const M of [ML, MR]) { for (let j = 1; j <= ns; j++) if (M[j] > M[j - 1] + 0.3) M[j] = M[j - 1] + 0.3; for (let j = ns - 1; j >= 0; j--) if (M[j] > M[j + 1] + 0.3) M[j] = M[j + 1] + 0.3; }
        // which spots of the grid a figure can be on: 1 clear, 0 something stands there, 255 outside the room
        const OK = new Uint8Array(N1 * NC).fill(255);
        for (let q = 0; q <= ns; q++) {
          const tx = -NZ[q] * 0.5, tz = NX[q] * 0.5;
          for (let c = Math.ceil(-ML[q] / CW - 1e-6); c <= Math.floor(MR[q] / CW + 1e-6); c++) {
            const o = c * CW, x = CX[q] + NX[q] * o, z = CZ[q] + NZ[q] * o;
            // (one wide test says the whole 1.5 m of line is clear - most are; else the spot and half a metre each way.
            // Not in a building: the room was measured along this very line)
            OK[q * NC + c + HC] = !blocked(x, z, 0.75) || !(blocked(x, z, 0.4) || blocked(x + tx, z + tz, 0.4) || blocked(x - tx, z - tz, 0.4)) ? 1 : 0;
          }
        }
        // the ground's height over the grid, a metre apart across (the street's own surface, the paving beside it): once, not per member
        const YG = new Float32Array(N1 * 19);
        for (let q = 0; q <= ns; q++) for (let c = -9; c <= 9; c++) YG[q * 19 + c + 9] = c < -ML[q] - 1 || c > MR[q] + 1 ? 0 : gh(CX[q] + NX[q] * c, CZ[q] + NZ[q] * c) || 0;
        const cost = new Float64Array(NC), prevC = new Float64Array(NC), from = new Int8Array(N1 * NC), OFF = new Float32Array(N1), DES = new Float32Array(N1);
        for (let j = 0; j < want; j++, k++) {
          const r = rng(0x51ed27 ^ Math.imul(k + 1, 2654435761) ^ strH(r0.id));
          const share = r(); r();
          for (let q = 0; q <= ns; q++) DES[q] = -ML[q] + share * (MR[q] + ML[q]);
          lanePath(ns, OK, DES, OFF, cost, prevC, from);
          // (on its own share wherever the grid put it within a cell of it: the lines are not 25 cm apart)
          for (let q = 0; q <= ns; q++) if (Math.abs(OFF[q]) <= CW * 0.5 + 1e-4) OFF[q] = 0;
          const MX = new Float32Array(N1), MZ = new Float32Array(N1), MS = new Float32Array(N1), MY = new Float32Array(N1);
          for (let q = 0; q <= ns; q++) {
            // (the step aside eased over its neighbours: a bend, not a corner)
            const dv = q > 0 && q < ns ? (OFF[q - 1] + 2 * OFF[q] + OFF[q + 1]) / 4 : OFF[q], o = DES[q] + (Math.abs(OFF[q]) > 0.6 ? OFF[q] * 0.75 + dv * 0.25 : dv);
            MX[q] = CX[q] + NX[q] * o; MZ[q] = CZ[q] + NZ[q] * o; MY[q] = YG[q * 19 + Math.max(-9, Math.min(9, Math.round(o))) + 9];
            if (q) MS[q] = MS[q - 1] + Math.hypot(MX[q] - MX[q - 1], MZ[q] - MZ[q - 1]);
          }
          member(10000 + k, r, MX, MZ, MS, null, null, 0, MY);
        }
        continue;
      }
      // (lines along the street with nothing standing on them: offsets tried at every 0.25 m, tested every 0.7 m of the
      // street's length; where no line is clear end to end, the least obstructed ones)
      let lines = []; const cand = [];
      for (let o = -half; o <= half + 1e-6; o += 0.25) {     // (0.25 m apart: a line between the bollards of a row across the street)
        let bad = 0, i = 0;
        for (let s = 0; s <= L; s += 0.7) {
          while (i < n - 2 && S[i + 1] < s) i++;
          const u = (s - S[i]) / ((S[i + 1] - S[i]) || 1), dx = (X[i + 1] - X[i]) / ((S[i + 1] - S[i]) || 1), dz = (Z[i + 1] - Z[i]) / ((S[i + 1] - S[i]) || 1);
          const x = X[i] + (X[i + 1] - X[i]) * u + dz * o, z = Z[i] + (Z[i + 1] - Z[i]) * u - dx * o;
          if (blocked(x, z, 0.42)) bad++;
        }
        cand.push([bad, o]); if (!bad) lines.push(o);
      }
      if (lines.length < 3) { cand.sort((a, b) => a[0] - b[0] || Math.abs(a[1]) - Math.abs(b[1])); lines = cand.slice(0, 3).map((c) => c[1]); }
      if (!lines.length) continue;
      for (let j = 0; j < want; j++, k++) {
        const r = rng(0x51ed27 ^ Math.imul(k + 1, 2654435761) ^ strH(r0.id));
        member(10000 + k, r, X, Z, S, null, null, lines[(r() * lines.length) | 0] + (r() - 0.5) * 0.3);
      }
    }
    // ---- (2) the walk graph on the other core streets
    // named street segments in the core box (20 m grid)
    const C = 20, segs = new Map(), key = (cx, cz) => cx * 65536 + cz, B = CORE_BOX;
    for (const r of map.roads) {
      const w = CORE_STREETS[r.name]; if (!w || !r.pts || STREET_WALK[r.name]) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        if (Math.max(a[0], b[0]) < B.minX || Math.min(a[0], b[0]) > B.maxX || Math.max(a[1], b[1]) < B.minZ || Math.min(a[1], b[1]) > B.maxZ) continue;
        if (r.name === 'High Street' && Math.min(a[0], b[0]) > HIGH_MAX_X) continue;
        const q = [a[0], a[1], b[0], b[1], (r.w || 6) / 2 + 6, w];
        for (let cx = Math.floor((Math.min(a[0], b[0]) - 10) / C); cx <= Math.floor((Math.max(a[0], b[0]) + 10) / C); cx++)
          for (let cz = Math.floor((Math.min(a[1], b[1]) - 10) / C); cz <= Math.floor((Math.max(a[1], b[1]) + 10) / C); cz++) { let l = segs.get(key(cx, cz)); if (!l) segs.set(key(cx, cz), (l = [])); l.push(q); }
      }
    }
    const N = G.count, wt = new Float32Array(N);
    let tot = 0;
    for (let i = 0; i < N; i++) {
      const x = G.X[i], z = G.Z[i];
      if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) continue;
      let best = 0;
      for (const q of segs.get(key(Math.floor(x / C), Math.floor(z / C))) || []) {
        const dx = q[2] - q[0], dz = q[3] - q[1], l2 = dx * dx + dz * dz; let t = l2 ? ((x - q[0]) * dx + (z - q[1]) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (Math.hypot(x - q[0] - dx * t, z - q[1] - dz * t) < q[4] && q[5] > best) best = q[5];
      }
      if (best > 0 && PS.wet && PS.wet(x, z)) best = 0;
      wt[i] = best; tot += best;
    }
    // room either side of a walk-graph edge (the members spread across the pavement): free of walls, off the carriageway
    const room = new Map();
    const roomOf = (a, b) => {
      const lo = a < b ? a : b, hi = a < b ? b : a, kk = lo * N + hi;
      let v = room.get(kk);
      if (!v) {
        // (worked out for lo -> hi: the band of clear lines to its left and to its right, each [from, to] in metres left
        // of the edge (so the right band is negative); left normal = (dz, -dx) as in traffic.js. A line is clear when
        // every 0.7 m of it is free of walls, furniture and parked things, off the carriageway and dry. A side with no
        // clear line borrows the other side's band; with none either side they keep to the graph's own line.)
        const ax = G.X[lo], az = G.Z[lo], bx = G.X[hi], bz = G.Z[hi], L = Math.hypot(bx - ax, bz - az) || 1, nx = (bz - az) / L, nz = -(bx - ax) / L;
        const ns = Math.max(2, Math.ceil(L / 0.7));
        const badAt = (o, all) => {
          let bad = 0;
          for (let q = 0; q <= ns; q++) { const f = q / ns, x = ax + (bx - ax) * f + nx * o, z = az + (bz - az) * f + nz * o; if ((PS.road && PS.road(x, z)) || (PS.wet && PS.wet(x, z))) return 1e6; if (blocked(x, z, 0.28)) { bad++; if (!all) return 1; } }
          return bad;
        };
        const clearAt = (o) => !badAt(o, false);
        const OFF = [0, 0.3, 0.6, 0.9, 1.2, 1.6, 2.0, 2.4, 2.8], band = (sg) => {
          let i0 = -1; for (let q = 0; q < OFF.length && i0 < 0; q++) if (clearAt(OFF[q] * sg)) i0 = q;
          if (i0 < 0 || OFF[i0] > 1.6) return null;
          let i1 = i0; while (i1 + 1 < OFF.length && clearAt(OFF[i1 + 1] * sg)) i1++;
          return [OFF[i0] * sg, OFF[i1] * sg];
        };
        const bl = band(1), br = band(-1);
        let fb = bl || br;
        if (!fb) { let bo = 0, bb = badAt(0, true); for (const o of [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2]) { const q = badAt(o, true); if (q < bb) { bb = q; bo = o; } } fb = [bo, bo]; }     // (no clear line: the least obstructed one)
        v = [bl || fb, br || fb];
        room.set(kk, v);
      }
      return a < b ? v : [[-v[1][0], -v[1][1]], [-v[0][0], -v[0][1]]];
    };
    if (tot > 0) {
      const idx = [], cw = [];
      let acc = 0; for (let i = 0; i < N; i++) if (wt[i] > 0) { acc += wt[i]; idx.push(i); cw.push(acc); }
      const pickStart = (u) => { let lo = 0, hi = cw.length - 1; const x = u * acc; while (lo < hi) { const m = (lo + hi) >> 1; if (cw[m] < x) lo = m + 1; else hi = m; } return idx[lo]; };
      for (let j = 0; j < GRAPH_N; j++) {
        const r = rng(0x9e3779b1 ^ (j * 2654435761));
        const want = 70 + r() * 150;
        let cur = pickStart(r()), prev = -1;
        const route = [cur];
        let len = 0;
        for (let step = 0; step < 160 && len < want; step++) {
          const s0 = G.start[cur], s1 = G.start[cur + 1];
          let best = -1, bs = -Infinity;
          for (let e = s0; e < s1; e++) {
            const v = G.nbr[e]; if (wt[v] <= 0 || v === prev) continue;
            if (PS.road && PS.road((G.X[v] + G.X[cur]) / 2, (G.Z[v] + G.Z[cur]) / 2)) continue;      // (never across a carriageway: they would walk through the traffic)
            let sc = r() * 0.9 + wt[v] * 0.05;
            if (prev >= 0) { const ax = G.X[cur] - G.X[prev], az = G.Z[cur] - G.Z[prev], bx = G.X[v] - G.X[cur], bz = G.Z[v] - G.Z[cur], la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1; sc += 1.4 * (ax * bx + az * bz) / (la * lb); }
            if (sc > bs) { bs = sc; best = v; }
          }
          if (best < 0) break;
          len += Math.hypot(G.X[best] - G.X[cur], G.Z[best] - G.Z[cur]);
          route.push(best); prev = cur; cur = best;
        }
        if (route.length < 2 || len < 25) continue;
        const n = route.length, X = new Float32Array(n), Z = new Float32Array(n), S = new Float32Array(n), RL = new Float32Array(n * 2), RR = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) {
          const v = route[i]; X[i] = G.X[v]; Z[i] = G.Z[v];
          if (i) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
          if (i < n - 1) { const rm = roomOf(v, route[i + 1]); RL[i * 2] = rm[0][0]; RL[i * 2 + 1] = rm[0][1]; RR[i * 2] = rm[1][0]; RR[i * 2 + 1] = rm[1][1]; }
        }
        member(j, r, X, Z, S, RL, RR, NaN);
      }
    }
    out.sort((a, b) => a.ord - b.ord);
    this.members = out;
    this.buildMs = performance.now() - t0;
  }

  update(dt) {
    const g = this.game, p = g.player, A = this.solid, F = this.fading;
    if (!this.built) { if ((this._t -= dt) > 0) return; this._t = 1; this._build(); if (!this.built) return; }
    if (p.place !== 'world' || g.scene !== g.worldScene || !this.members.length) { A.hide(); F.hide(); return; }
    const q = g.quality, lvl = (q && q.level) || 'low', tier = busyTier(lvl), dq = q && q.dist > 0 && q.dist < 1 ? Math.max(0.5, q.dist) : 1;
    const R = tier.crowdR * dq, cam = g.camera, cx = cam.position.x, cz = cam.position.z;
    // nothing to do far from the core
    const B = CORE_BOX;
    if (cx < B.minX - R || cx > B.maxX + R || cz < B.minZ - R || cz > B.maxZ + R) { A.hide(); F.hide(); this.shown = 0; return; }
    const hour = g.time ? g.time.hour : 12, wx = g.weather, share = busyHour(hour) * (wx && wx.crowd < 1 ? Math.max(0.4, wx.crowd) : 1);
    const limit = Math.min(this.members.length, tier.crowd);
    cam.getWorldDirection(_fw); const fl = Math.hypot(_fw.x, _fw.z) || 1, fx = _fw.x / fl, fz = _fw.z / fl;
    const t = (g.time && g.time.now ? g.time.now() : Date.now()) / 1000;
    // (fading in over FADE_W m beyond tier.fade: alpha, in a second, blended draw)
    const R2 = R * R, n0 = tier.fade * dq, n1 = (tier.fade + FADE_W) * dq;
    // Within reach of the PLAYER (2026-11-22; the fade above is from the camera, so with the camera pulled back, or from a
    // vehicle, whole figures stood where the player was and were walked through). On foot: a figure that comes within
    // HAND_IN of the player while it is drawn is handed over to a real walker of the same colours and height, with a
    // body, who keeps to the figure's line by the same clock (systems/_ped_solid.js stand-ins) and is handed back beyond
    // HAND_OUT; m.hold carries the figure's alpha across (a half-faded one is first faded up where it stands, one handed
    // back near the camera fades away). With no stand-in to be had (all out; in a vehicle): gone inside P0 of the
    // player (2 m; 5 m from a vehicle), whole FADE_W further out — never a figure where the player is.
    const PSY = g.pedestrians && g.pedestrians._sys, SI = PSY && PSY.solid ? PSY.solid : null, onFoot = !p.vehicle && !p.swim;
    const ppx = p.pos.x, ppz = p.pos.z, P0 = onFoot ? 2 : 5, HR = dt * 2.6, frame = PSY ? PSY.frame : 0;
    // In a vehicle (2026-11-24): the people on the pavement stay as the car goes by (they used to be gone inside 5 m of
    // it: everyone the player drove past vanished and came back behind). Only who is in the car's WAY - a strip 2.4 m
    // either side of its line, from just behind it to a second's travel ahead - is handed over to a real walker, who
    // can jump clear or be knocked like anybody; with none to be had the figure is gone just before the car touches it.
    const veh = !onFoot && p.vehicle && typeof p.vehicle.heading === 'number' ? p.vehicle : null;
    let vhx = 0, vhz = 1, vAhead = 0;
    if (veh) { const sgn = veh.speed < 0 ? -1 : 1; vhx = Math.sin(veh.heading) * sgn; vhz = Math.cos(veh.heading) * sgn; vAhead = 5 + Math.min(16, Math.abs(veh.speed || 0)); }
    // Who is out follows the hour and the weather (m.gate against the share) - but nobody comes or goes with it where a
    // player can see: a member changes only out of the camera's picture, behind a building, or beyond the drawing radius.
    const seenBy = PSY && PSY._unseenMe ? PSY : null;
    // A figure the camera is about to come close to, in the picture, is handed over to a real walker as well (it used to
    // fade away 7-9.5 m from the camera unless it was also within reach of the player: everyone the car drove past).
    const SV0 = seenBy !== null ? seenBy._vw : null, pic = !!SV0 && !SV0.none && !SV0.all && SI !== null && !p.swim && !tier.noFade;
    const camIn2 = (n1 + 1) * (n1 + 1), camOut2 = (n1 + 2.6) * (n1 + 2.6);
    A.begin(); F.begin(); const FQ = this._fq; FQ.length = 0; let hole = 0;
    for (let i = 0; i < limit; i++) {
      const m = this.members[i];
      const want = m.gate <= share;
      if (m.on === undefined) m.on = want;
      if (!m.on && !want) continue;
      // (the route's box against the drawing radius)
      const ex = cx < m.x0 ? m.x0 - cx : cx > m.x1 ? cx - m.x1 : 0, ez = cz < m.z0 ? m.z0 - cz : cz > m.z1 ? cz - m.z1 : 0;
      if (ex * ex + ez * ez > R2) { m.on = want; continue; }
      // where along the route: there and back
      const L = m.len; let d = (t * m.speed + m.phase) % (2 * L); if (d < 0) d += 2 * L;
      const back = d > L, s = back ? 2 * L - d : d;
      let lo = 0, hi = m.n - 2;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (m.S[mid] <= s) lo = mid; else hi = mid - 1; }
      const S0 = m.S[lo], S1 = m.S[lo + 1], u = S1 > S0 ? (s - S0) / (S1 - S0) : 0;
      let dx = m.X[lo + 1] - m.X[lo], dz = m.Z[lo + 1] - m.Z[lo]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      // a street walker keeps its line across the street; a graph walker keeps to one side of the pavement for the way
      // it is going (left of the drawn leg: +side), within its room
      let ox, oz;
      if (m.fixOff === m.fixOff) { ox = dz * m.fixOff; oz = -dx * m.fixOff; }
      else {
        const sd = back ? -m.side : m.side, B = sd > 0 ? m.RL : m.RR, f = sd > 0 ? sd : -sd;
        // (at either end it comes back on the other side: it crosses over the last TURN_W m - it used to jump across)
        const e = s < L - s ? s : L - s, tw = e < TURN_W ? 0.5 * (1 - e / TURN_W) : 0, B2 = tw > 0 ? (sd > 0 ? m.RR : m.RL) : null;
        let off = B[lo * 2] + (B[lo * 2 + 1] - B[lo * 2]) * f;
        if (B2 !== null) off += (B2[lo * 2] + (B2[lo * 2 + 1] - B2[lo * 2]) * f - off) * tw;
        ox = dz * off; oz = -dx * off;
        // (round a corner of its route: the line beside one leg does not meet the line beside the next - with 2-3 m of
        //  pavement between it and the route that was a 2-3.5 m jump at every corner. Within 2 m of the corner the two
        //  legs' offsets are blended, half and half at the corner itself.)
        const seg = S1 - S0, wc = seg < 4 ? seg * 0.5 : 2, a0 = s - S0, a1 = S1 - s;
        let j = -1, w = 0;
        if (a1 < wc && lo < m.n - 2) { j = lo + 1; w = 0.5 * (1 - a1 / wc); } else if (a0 < wc && lo > 0) { j = lo - 1; w = 0.5 * (1 - a0 / wc); }
        if (j >= 0) {
          let gx = m.X[j + 1] - m.X[j], gz = m.Z[j + 1] - m.Z[j]; const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl;
          let o2 = B[j * 2] + (B[j * 2 + 1] - B[j * 2]) * f;
          if (B2 !== null) o2 += (B2[j * 2] + (B2[j * 2 + 1] - B2[j * 2]) * f - o2) * tw;
          ox += (gz * o2 - ox) * w; oz += (-gx * o2 - oz) * w;
        }
      }
      const x = m.X[lo] + (m.X[lo + 1] - m.X[lo]) * u + ox, z = m.Z[lo] + (m.Z[lo + 1] - m.Z[lo]) * u + oz;
      const vx = x - cx, vz = z - cz, dd = vx * vx + vz * vz;
      const ex2 = x - ppx, ez2 = z - ppz, dp2 = ex2 * ex2 + ez2 * ez2;
      let real = m.real;
      if (real !== null && (real.cm !== m || !real.active)) real = m.real = null;
      if (m.on !== want && real === null) {
        // (unseen: beyond the radius, out of the picture, or - a few a frame - a building in the way)
        const SV = seenBy !== null ? seenBy._vw : null;
        if (dd > R2 || !SV || SV.none || (!SV.all && seenBy._behind(x, z))) m.on = want;
        else if (((i + frame) & 7) === 0 && seenBy._unseenMe(x, z)) m.on = want;      // (a building in the way: each waiting member asked every eighth frame)
        if (!m.on) continue;
      }
      // (in the way of the player's vehicle?)
      let way = false, capD = 1e9;
      if (veh !== null && dp2 < 900) {
        const fw = ex2 * vhx + ez2 * vhz, lat = Math.abs(ex2 * vhz - ez2 * vhx);
        way = lat < 2.4 && fw > -3 && fw < vAhead;
        const fc = fw < -2.4 ? fw + 2.4 : fw > 2.6 ? fw - 2.6 : 0; capD = Math.sqrt(fc * fc + lat * lat);
      }
      const byCam = pic && dd < camOut2 && !seenBy._behind(x, z);      // (near the camera and in its picture)
      if (real === null && m.hold <= 0 && (dd > R2 || (dd < n0 * n0 && dp2 > HAND_IN2 && !way && !byCam))) continue;
      const dist = Math.sqrt(dd), behind = vx * fx + vz * fz < -4;      // (behind the camera)
      let hx = back ? -dx : dx, hz = back ? -dz : dz;
      if (!m.speed) { hx = Math.sin(m.face); hz = Math.cos(m.face); }          // (stood looking in a window, chatting)
      // how much of it the camera's distance leaves (low: all or nothing)
      let a = behind || dist <= n0 ? 0 : dist >= n1 || tier.noFade ? 1 : (dist - n0) / (n1 - n0); if (a > 0 && a < 1) a = a * a * (3 - 2 * a);
      // (no stand-in for it: never a figure where the player is)
      let ring = 1;
      if (veh !== null) { if (capD < 2.3) { const f = capD <= 1.3 ? 0 : capD - 1.3; ring = tier.noFade ? (f >= 0.5 ? 1 : 0) : f * f * (3 - 2 * f); } }
      else if (dp2 < (P0 + FADE_W) * (P0 + FADE_W)) { const dp = Math.sqrt(dp2), f = dp <= P0 ? 0 : (dp - P0) / FADE_W; ring = tier.noFade ? (f >= 0.5 ? 1 : 0) : f * f * (3 - 2 * f); }
      if (real === null && SI !== null && ((veh !== null ? way : onFoot && dp2 < HAND_IN2) || (byCam && dd < camIn2)) && a * ring >= 0.5) {      // (one already gone from beside the player stays gone until it is clear of them: nobody appears at the player's elbow)
        real = SI.standIn(m, x, z, hx, hz, ring < 0.999 || veh !== null);
        if (real !== null) { m.real = real; m.hold = tier.noFade ? 1 : Math.max(a * ring, m.hold * ring); real.veil = m.hold < 0.98; }
      }
      let px = x, pz = z;
      if (real !== null) {
        real.cx = x; real.cz = z; real.chx = hx; real.chz = hz; real.cF = frame;
        if (real.veil) {
          // fading up where the stand-in stands, then it is the one drawn
          m.hold += HR; if (m.hold >= 1) { m.hold = 0; real.veil = false; continue; }
          px = real.x; pz = real.z; a = m.hold;
        } else if (dp2 > HAND_OUT2 && !way && !byCam && !real.down && !(real.hopT > 0) && (Math.abs(real.x - x) + Math.abs(real.z - z) < 0.3 || dp2 > 400)) { SI.standOut(real); m.real = null; m.hold = 1; }
        else continue;                                             // (drawn as a real person)
      }
      if (m.real === null) {
        if (ring < 0.5 && a >= 0.5) hole++;                        // (left out for want of a stand-in)
        if (m.hold > 0) { m.hold -= HR; if (m.hold < 0) m.hold = 0; if (!behind && m.hold > a) a = m.hold; }
        a *= ring;
      }
      if (a <= 0.01) continue;
      const y = m.Y[lo] + (m.Y[lo + 1] - m.Y[lo]) * u;
      const ph = (s / m.stride) * Math.PI % TAU;
      // (the far edge: thinning out over the last FAR_W m of the radius, in the opaque draw itself - no cut-off line)
      if (a >= 0.995) { const fe = (R - dist) / FAR_W; A.put(m, px, y, pz, hx, hz, ph, fe >= 1 ? 1 : fe < 0.04 ? 0.04 : fe); }          // (low: no second draw, they just stop at the fade distance)
      else if (!tier.noFade && FQ.length < MAXF) {
        const e = this._fqPool[FQ.length] || (this._fqPool[FQ.length] = {});     // (pooled: nothing allocated a frame)
        e.m = m; e.x = px; e.y = y; e.z = pz; e.hx = hx; e.hz = hz; e.ph = ph; e.f = a; e.dist = dist; FQ.push(e);
      }
    }
    // (the few fading ones far to near: they write depth, so a nearer one drawn first would hide a farther one outright)
    if (FQ.length > 1) FQ.sort(byFar);
    for (const e of FQ) F.put(e.m, e.x, e.y, e.z, e.hx, e.hz, e.ph, e.f);
    A.end(); F.end();
    this.shown = A.c + F.c; this.faded = F.c; this.hole = hole;
  }

  stats() { return { built: this.built, members: this.members.length, shown: this.shown, fading: this.faded, hole: this.hole || 0, buildMs: +this.buildMs.toFixed(1) }; }
}
const _fw = new THREE.Vector3();
const byFar = (a, b) => b.dist - a.dist;

export default {
  id: 'crowd',
  install(game) {
    if (!busyOn()) return null;
    const c = new Crowd(game);
    game.crowd = c.api;
    return { id: 'crowd', update: (dt) => c.update(dt) };
  },
};
