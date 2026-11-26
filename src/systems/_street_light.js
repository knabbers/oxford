// Streetscape decals: ONE premultiplied-alpha draw for everything flat or glowing that the street adds — warm pools of
// lamplight on the pavement, halos round the lanterns (camera-facing), flashing Belisha glows, soft contact shadows
// under the furniture, tree grilles, fallen leaves, pavement stains. Blending is (ONE, ONE_MINUS_SRC_ALPHA): a decal
// with colour and no alpha ADDS light, one with alpha and no colour darkens, one with both is an ordinary decal — so
// light and shade share a draw. No real lights; the glows are gated per lamp by world.night (the photocells' stagger).
//
// Vertex layout: position (world; for billboards the lamp head), uv (decal atlas), aCol vec4 (rgb = light / colour,
// a = coverage), aP vec4 (x: gate — >= 0 night threshold, -1 lit by the scene (dims at night), -2 flashing, -4 plain;
// y: billboard size (0 = ground decal); z, w: billboard corner -1..1).
import { TERRAIN_VS } from '../world/terrain.js';
import * as THREE from 'three';

export const DW = 512, DH = 256;
export const DRECT = { disc: [0, 0, 128, 128], halo: [128, 0, 128, 128], leaves: [256, 0, 128, 128], grille: [384, 0, 128, 128], stain: [0, 128, 128, 128], worn: [128, 128, 128, 128], pool: [256, 128, 128, 128] };
export const duv = (r) => [(r[0] + 1) / DW, 1 - (r[1] + r[3] - 1) / DH, (r[0] + r[2] - 1) / DW, 1 - (r[1] + 1) / DH];

export function paintDecals() {
  const c = document.createElement('canvas'); c.width = DW; c.height = DH;
  const g = c.getContext('2d'); g.clearRect(0, 0, DW, DH);
  const radial = (r, stops) => { const [x, y, w] = r, cx = x + w / 2, cy = y + w / 2, gr = g.createRadialGradient(cx, cy, 0, cx, cy, w / 2); for (const [t, col] of stops) gr.addColorStop(t, col); g.fillStyle = gr; g.fillRect(x, y, w, w); };
  radial(DRECT.disc, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.75)'], [0.7, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
  // lamplight on the ground: a bright core under the lantern and a long soft fall-off (no hard rim)
  radial(DRECT.pool, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,0.8)'], [0.45, 'rgba(255,255,255,0.32)'], [0.75, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
  radial(DRECT.halo, [[0, 'rgba(255,255,255,1)'], [0.08, 'rgba(255,255,255,0.9)'], [0.22, 'rgba(255,255,255,0.32)'], [0.5, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
  { const [x, y, w] = DRECT.halo, cx = x + w / 2, cy = y + w / 2; g.globalCompositeOperation = 'lighter'; for (const a of [0, Math.PI / 2]) { const gr = g.createLinearGradient(cx - Math.cos(a) * 60, cy - Math.sin(a) * 60, cx + Math.cos(a) * 60, cy + Math.sin(a) * 60); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.save(); g.translate(cx, cy); g.rotate(a); g.fillRect(-60, -1.5, 120, 3); g.restore(); } g.globalCompositeOperation = 'source-over'; }
  let s = 5; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // fallen leaves: plane / lime / horse-chestnut colours, denser in the middle
  { const [x, y, w] = DRECT.leaves; for (let i = 0; i < 150; i++) { const a = rnd() * 6.283, rr = Math.pow(rnd(), 0.7) * w * 0.46, px = x + w / 2 + Math.cos(a) * rr, py = y + w / 2 + Math.sin(a) * rr; const k = rnd(); g.fillStyle = k < 0.3 ? '#8a5a1e' : k < 0.55 ? '#b07a26' : k < 0.75 ? '#6b4a1c' : k < 0.9 ? '#9c8a32' : '#5a3a14'; g.globalAlpha = 0.85; g.save(); g.translate(px, py); g.rotate(rnd() * 6.28); g.beginPath(); g.ellipse(0, 0, 3 + rnd() * 3, 1.6 + rnd() * 1.6, 0, 0, 7); g.fill(); g.restore(); } g.globalAlpha = 1; }
  // tree grille: cast-iron square with radial slots round the trunk hole
  { const [x, y, w] = DRECT.grille, cx = x + w / 2, cy = y + w / 2; g.fillStyle = 'rgba(28,28,28,0.95)'; g.fillRect(x + 4, y + 4, w - 8, w - 8); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill(); for (let rr = 28; rr < 58; rr += 9) for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.283 + rr; g.beginPath(); g.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3.2, 1.4, a, 0, 7); g.fill(); } g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(60,46,30,0.9)'; g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill(); }
  // pavement stains and chewing gum: faint blotches and pale dots
  { const [x, y, w] = DRECT.stain; for (let i = 0; i < 9; i++) { const px = x + 14 + rnd() * (w - 28), py = y + 14 + rnd() * (w - 28), rr = 6 + rnd() * 14, gr = g.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, 'rgba(20,18,14,0.35)'); gr.addColorStop(1, 'rgba(20,18,14,0)'); g.fillStyle = gr; g.fillRect(px - rr, py - rr, rr * 2, rr * 2); } for (let i = 0; i < 70; i++) { g.fillStyle = rnd() < 0.7 ? 'rgba(205,200,188,0.85)' : 'rgba(40,38,34,0.7)'; g.beginPath(); g.arc(x + 4 + rnd() * (w - 8), y + 4 + rnd() * (w - 8), 1 + rnd() * 1.6, 0, 7); g.fill(); } }
  // worn grass: bare earth in the middle feathering out
  radial(DRECT.worn, [[0, 'rgba(120,96,62,0.9)'], [0.45, 'rgba(118,100,64,0.6)'], [1, 'rgba(110,104,70,0)']]);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.premultiplyAlpha = true;
  return t;
}

export function decalMaterial(map, U) {
  const m = new THREE.ShaderMaterial({
    name: 'street:decals',
    uniforms: { map: { value: map }, uNight: U.night, uTime: U.time, uFogD: { value: 0 }, uAmb: { value: 1 }, uPool: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec4 aCol; attribute vec4 aP;
      uniform float uNight, uTime, uFogD, uAmb, uPool;` + TERRAIN_VS + `
      varying vec2 vUv; varying vec4 vCol;
      void main() {
        vUv = uv;
        float g = aP.x, k = 1.0, lit = 1.0;
        if (g >= 0.0) { k = smoothstep(g, g + 0.05, uNight); if (aP.y <= 0.0) lit = uPool; }   // (uPool: the lamp pools dim where the light map lights the ground itself)
        else if (g < -3.5) k = 1.0;
        else if (g < -1.5) k = step(0.5, fract(uTime * 0.8 + position.x * 0.37 + position.z * 0.11)) * (0.3 + 0.7 * uNight);
        else lit = uAmb;
        vec3 wp = position;
        if (g < -4.5) {                                     // a moth round a lamp: a lazy wobbling orbit, after dark
          float ph = position.x * 17.3 + position.z * 11.1, t = uTime;
          wp += vec3(sin(t * 3.1 + ph) * 0.32 + sin(t * 7.3 + ph * 2.0) * 0.06, sin(t * 2.3 + ph * 1.7) * 0.22, cos(t * 2.7 + ph) * 0.32 + cos(t * 6.1 + ph) * 0.05);
          k = smoothstep(0.45, 0.65, uNight); lit = 1.0;
        }
        vec4 mv = modelViewMatrix * vec4(wp, 1.0);
        mv.xyz += GTO_DH(wp.xz);                            // hills (world/terrain.js)
        if (aP.y > 0.0) {
          float d = -mv.z, sz = aP.y * (g < -4.5 ? 1.0 : max(1.0, d / 120.0));
          mv.xy += aP.zw * sz;
          mv.z += min(0.6, aP.y * 0.5);                     // in front of the lantern glass
        } else {
          mv.xyz *= 1.0 - 12.0 * 0.0005;                    // the city ground's view-ray layer bias, above the markings
        }
        gl_Position = projectionMatrix * mv;
        float f = exp(-uFogD * length(mv.xyz));
        vCol = vec4(aCol.rgb * k * lit * f, aCol.a * f * (g >= 0.0 || (g < -1.5 && g > -3.5) || g < -4.5 ? k : 1.0));
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
      void main() {
        vec4 t = texture2D(map, vUv);
        gl_FragColor = vec4(t.rgb * vCol.rgb, t.a * vCol.a);
      }`,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    premultipliedAlpha: true,
  });
  return m;
}

/** Growable writer for the decal buffer (fixed capacity; returns false when full). */
export class DecalWriter {
  constructor(cap) {
    this.cap = cap; this.pos = new Float32Array(cap * 3); this.uv = new Float32Array(cap * 2); this.col = new Float32Array(cap * 4); this.p = new Float32Array(cap * 4);
    this.idx = new Uint32Array(Math.floor(cap * 1.6)); this.nv = 0; this.ni = 0;
  }
  reset() { this.nv = 0; this.ni = 0; }
  _v(x, y, z, u, v, c, p) {
    const i = this.nv++; this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
    this.col[i * 4] = c[0]; this.col[i * 4 + 1] = c[1]; this.col[i * 4 + 2] = c[2]; this.col[i * 4 + 3] = c[3];
    this.p[i * 4] = p[0]; this.p[i * 4 + 1] = p[1]; this.p[i * 4 + 2] = p[2]; this.p[i * 4 + 3] = p[3]; return i;
  }
  /** flat ground decal: rect r, centre (x, y, z), half sizes a (along angle rot) and b, colour/coverage c, gate g */
  ground(r, x, y, z, a, b, rot, c, g) {
    if (this.nv + 4 > this.cap || this.ni + 6 > this.idx.length) return false;
    const [u0, v0, u1, v1] = duv(r), cs = Math.cos(rot), sn = Math.sin(rot), P = [g, 0, 0, 0];
    const q = (s, t, u, v) => this._v(x + cs * s * a + sn * t * b, y, z - sn * s * a + cs * t * b, u, v, c, P);
    const i0 = q(-1, -1, u0, v0), i1 = q(1, -1, u1, v0), i2 = q(1, 1, u1, v1), i3 = q(-1, 1, u0, v1);
    // wound to face up
    const I = this.idx, n = this.ni; I[n] = i0; I[n + 1] = i2; I[n + 2] = i1; I[n + 3] = i0; I[n + 4] = i3; I[n + 5] = i2; this.ni += 6;
    return true;
  }
  /** flat octagon (less fill than a quad for a round pool of light) */
  octagon(r, x, y, z, rad, sx, c, g, rot = 0) {
    if (this.nv + 9 > this.cap || this.ni + 24 > this.idx.length) return false;
    const [u0, v0, u1, v1] = duv(r), cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, hu = (u1 - u0) / 2, hv = (v1 - v0) / 2, P = [g, 0, 0, 0], ro = 1 / Math.cos(Math.PI / 8);
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const c0 = this._v(x, y, z, cu, cv, c, P), ring = [];
    for (let k = 0; k < 8; k++) { const an = ((k + 0.5) / 8) * Math.PI * 2, ex = Math.cos(an) * ro, ez = Math.sin(an) * ro, lx = ex * rad * sx, lz = ez * rad; ring.push(this._v(x + lx * cs + lz * sn, y, z - lx * sn + lz * cs, cu + ex * hu, cv - ez * hv, c, P)); }
    const I = this.idx; for (let k = 0; k < 8; k++) { const n = this.ni; I[n] = c0; I[n + 1] = ring[(k + 1) % 8]; I[n + 2] = ring[k]; this.ni += 3; }
    return true;
  }
  /** camera-facing billboard at (x, y, z) of size s (half width, metres) */
  bill(r, x, y, z, s, c, g) {
    if (this.nv + 4 > this.cap || this.ni + 6 > this.idx.length) return false;
    const [u0, v0, u1, v1] = duv(r);
    const i0 = this._v(x, y, z, u0, v0, c, [g, s, -1, -1]), i1 = this._v(x, y, z, u1, v0, c, [g, s, 1, -1]), i2 = this._v(x, y, z, u1, v1, c, [g, s, 1, 1]), i3 = this._v(x, y, z, u0, v1, c, [g, s, -1, 1]);
    const I = this.idx, n = this.ni; I[n] = i0; I[n + 1] = i1; I[n + 2] = i2; I[n + 3] = i0; I[n + 4] = i2; I[n + 5] = i3; this.ni += 6;
    return true;
  }
}
