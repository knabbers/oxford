// Shared kit for the Radcliffe Square modules (owned by places/radcliffe_square.js).
// Geometry goes through the Worcester Batch (merged, one atlas material) but with the area's OWN atlas (_rad_atlas.js:
// ashlar, rustication, rubble, panelling, lead, ornament bands and whole-cell windows; it no longer borrows Worcester's
// pack, so the old WORCESTER_GROUND coupling is gone). RB adds smooth normals and lathes (Batch is flat-shaded).
// Signs, painted school-door boards, ironwork decals and the like are one more canvas atlas (radSigns), alpha-tested.
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts, tudorPts, segPts, bayLit, contactStrips } from './_worcester_kit.js';
import { radPack } from './_rad_atlas.js';
import { tn } from '../core/features.js';

export { Batch, frame, rectPts, archPts, tudorPts, segPts, bayLit, contactStrips };

export const TAU = Math.PI * 2;
export const hash = (a, b = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
export const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
export const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
export const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** the area's atlas pack (one material for all the masonry, roofs, joinery and painted windows) */
export function pack(world) { return radPack(world); }
/** kept for the helpers' existing calls: every key now lives in the area's own pack */
export function packKeys(world) { return radPack(world); }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _g = new THREE.Vector3(), _m3 = new THREE.Matrix3();
/**
 * Batch with explicit (smooth) normals. Angle convention as Batch.cyl: a point at angle a, radius r is
 * (cx + sin a * r, y, cz + cos a * r).
 */
export class RB extends Batch {
  /** triangle with normals (current frame); winding is fixed so the face points along the mean normal */
  triN(key, p0, p1, p2, n0, n1, n2, t0, t1, t2) {
    const P = this._p(key), m = this.m;
    _m3.setFromMatrix4(m);
    _a.set(p0[0], p0[1], p0[2]).applyMatrix4(m); _b.set(p1[0], p1[1], p1[2]).applyMatrix4(m); _c.set(p2[0], p2[1], p2[2]).applyMatrix4(m);
    _g.subVectors(_b, _a).cross(_n.subVectors(_c, _a));
    const N = [n0, n1, n2].map((n) => new THREE.Vector3(n[0], n[1], n[2]).applyMatrix3(_m3).normalize());
    const mean = _n.copy(N[0]).add(N[1]).add(N[2]);
    let V = [_a.clone(), _b.clone(), _c.clone()], T = [t0, t1, t2];
    if (_g.dot(mean) < 0) { V = [V[0], V[2], V[1]]; N.splice(1, 2, N[2], N[1]); T = [t0, t2, t1]; }
    for (let i = 0; i < 3; i++) { P.pos.push(V[i].x, V[i].y, V[i].z); P.nor.push(N[i].x, N[i].y, N[i].z); P.uv.push(T[i][0], T[i][1]); }
  }
  quadN(key, A, B, C, D, nA, nB, nC, nD, tA, tB, tC, tD) { this.triN(key, A, B, C, nA, nB, nC, tA, tB, tC); this.triN(key, A, C, D, nA, nC, nD, tA, tC, tD); }
  /**
   * Surface of revolution about the vertical axis through (cx, cz) (current frame). prof: [[r, y, key?, band?], ...]
   * bottom to top; a point's key (default `key`) colours the segment that starts there; band = true maps that segment's
   * v 0..1 (the ornament bands: leaf, dentil, egg, balus). Normals are smoothed across joints flatter than o.crease
   * (rad, default 0.5) and split at sharper ones (mouldings keep their arrises). o: {seg, a0, a1, crease, inside (faces
   * point at the axis: niches), facet (seg flat faces: r is the apothem, corners at r / cos), v0}.
   */
  lathe(key, cx, cz, prof, o = {}) {
    const seg = o.seg || 16, a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, crease = o.crease ?? 0.5, sg = o.inside ? -1 : 1, fac = !!o.facet;
    const half = (a1 - a0) / seg / 2, kc = fac ? 1 / Math.cos(half) : 1;
    const S = [];
    let vAcc = o.v0 || 0;
    for (let j = 0; j < prof.length - 1; j++) {
      const [r0, y0] = prof[j], [r1, y1] = prof[j + 1], dr = r1 - r0, dy = y1 - y0, L = Math.hypot(dr, dy);
      if (L < 1e-6) { S.push(null); continue; }
      S.push({ r0, y0, r1, y1, nr: (dy / L) * sg, ny: (-dr / L) * sg, key: prof[j][2] || key, band: !!prof[j][3], v0: vAcc, v1: vAcc + L });
      vAcc += L;
    }
    const smooth = (s, t) => s && t && Math.acos(Math.max(-1, Math.min(1, s.nr * t.nr + s.ny * t.ny))) < crease;
    for (let j = 0; j < S.length; j++) {
      const s = S[j]; if (!s) continue;
      if (s.r0 < 1e-5 && s.r1 < 1e-5) continue;
      const p = S[j - 1], q = S[j + 1];
      const nS = smooth(p, s) ? [(p.nr + s.nr) / 2, (p.ny + s.ny) / 2] : [s.nr, s.ny];
      const nE = smooth(s, q) ? [(q.nr + s.nr) / 2, (q.ny + s.ny) / 2] : [s.nr, s.ny];
      const rm = Math.max((s.r0 + s.r1) / 2, 0.05);
      const v0 = s.band ? 0 : s.v0, v1 = s.band ? 1 : s.v1;
      for (let i = 0; i < seg; i++) {
        const t0 = a0 + (i / seg) * (a1 - a0), t1 = a0 + ((i + 1) / seg) * (a1 - a0), tm = (t0 + t1) / 2;
        const P = (t, r, y) => [cx + Math.sin(t) * r * kc, y, cz + Math.cos(t) * r * kc];
        const N = (t, n) => [Math.sin(fac ? tm : t) * n[0], n[1], Math.cos(fac ? tm : t) * n[0]];
        const u0 = t0 * rm * kc, u1 = t1 * rm * kc;
        const A = P(t0, s.r0, s.y0), B = P(t1, s.r0, s.y0), C = P(t1, s.r1, s.y1), D = P(t0, s.r1, s.y1);
        if (s.r1 < 1e-5) this.triN(s.key, A, B, C, N(t0, nS), N(t1, nS), N(tm, nE), [u0, v0], [u1, v0], [(u0 + u1) / 2, v1]);
        else if (s.r0 < 1e-5) this.triN(s.key, A, C, D, N(tm, nS), N(t1, nE), N(t0, nE), [(u0 + u1) / 2, v0], [u1, v1], [u0, v1]);
        else this.quadN(s.key, A, B, C, D, N(t0, nS), N(t1, nS), N(t1, nE), N(t0, nE), [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
      }
    }
  }
  /** a moulded band swept along a polyline path [[x, y, z], ...] (current frame) with section [[s, n], ...] (s across,
   *  n outwards along `out`, a fixed outward direction [x,y,z]); flat per strip, used for ribs, archivolts, raking cornices */
  sweep(key, path, section, out, o = {}) {
    const ox = out[0], oy = out[1], oz = out[2];
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], L = Math.hypot(tx, ty, tz) || 1;
      // across = tangent x out
      const sx = (ty * oz - tz * oy) / L, sy = (tz * ox - tx * oz) / L, sz = (tx * oy - ty * ox) / L;
      for (let k = 0; k < section.length - 1; k++) {
        const [s0, n0] = section[k], [s1, n1] = section[k + 1];
        const pt = (p, s, n) => [p[0] + sx * s + ox * n, p[1] + sy * s + oy * n, p[2] + sz * s + oz * n];
        const ds = s1 - s0, dn = n1 - n0, l = Math.hypot(ds, dn) || 1, nn = [(ox * ds - sx * dn) / l, (oy * ds - sy * dn) / l, (oz * ds - sz * dn) / l];
        const v = o.u0 || 0;
        this.poly(section[k][2] || key, [pt(a, s0, n0), pt(b, s0, n0), pt(b, s1, n1), pt(a, s1, n1)], nn, [[v + i * L, s0], [v + (i + 1) * L, s0], [v + (i + 1) * L, s1], [v + i * L, s1]]);
      }
    }
  }
}

/** Build a Batch into `parent` with the pack; meshes renamed 'rad:<what>:<group>' (so tests and perf can find them). */
export function buildBatch(B, world, parent, what, opts = {}) {
  const P = pack(world);
  const extra = opts.mats || {};
  const meshes = B.build(extra, parent, { pack: P, ...opts });
  for (const m of meshes) m.name = 'rad:' + what + ':' + m.name.replace(/^worcester:/, '');
  return meshes;
}

// ------------------------------------------------------------------------------------------------ sign atlas
let SIGNS = null;
/** Painted lettering and ironwork decals: {texture, material, uv(name) -> [u0,v0,u1,v1]}. 1024², 16 x 16 grid of 64 px. */
export function radSigns(world) {
  if (SIGNS) return SIGNS;
  const S = 64, N = 16, W = S * N;
  const c = document.createElement('canvas'); c.width = W; c.height = W;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, W);
  const cells = {};
  const put = (name, col, row, w, h, draw) => {
    g.save(); g.translate(col * S, row * S); g.beginPath(); g.rect(0, 0, w * S, h * S); g.clip(); draw(g, w * S, h * S); g.restore();
    const p = 1.5; cells[name] = [(col * S + p) / W, 1 - ((row + h) * S - p) / W, ((col + w) * S - p) / W, 1 - (row * S + p) / W];
  };
  const text = (t, x, y, size, color, font = 'Georgia, "Times New Roman", serif', weight = 'bold') => { g.fillStyle = color; g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y); };
  const fit = (t, w, size) => { g.font = `bold ${size}px Georgia, serif`; const m = g.measureText(t).width; return m > w ? Math.floor(size * w / m) : size; };
  // ---- the Schools' doors: gilt Roman capitals on a dark blue board (KNOWN: painted names over the doors; the
  // colours are as seen today — dark blue ground, gold letters — see the research doc)
  SCHOOLS.forEach((name, i) => put('school' + i, 0, i, 8, 1, (gg, w, h) => {
    gg.fillStyle = '#16264f'; gg.fillRect(0, 0, w, h); gg.strokeStyle = '#c9a54a'; gg.lineWidth = 3; gg.strokeRect(4, 4, w - 8, h - 8);
    const lines = name.split('|');
    if (lines.length === 1) text(lines[0], w / 2, h / 2 + 2, fit(lines[0], w - 30, 30), '#e6c766');
    else { const sz = Math.min(fit(lines[0], w - 30, 24), fit(lines[1], w - 30, 24)); text(lines[0], w / 2, h * 0.32, sz, '#e6c766'); text(lines[1], w / 2, h * 0.72, sz, '#e6c766'); }
  }));
  // ---- notices (invented wording)
  const notice = (name, col, row, w, h, bg, fg, lines, sizes) => put(name, col, row, w, h, (gg, ww, hh) => {
    gg.fillStyle = bg; gg.fillRect(0, 0, ww, hh); gg.strokeStyle = fg; gg.lineWidth = 3; gg.strokeRect(5, 5, ww - 10, hh - 10);
    lines.forEach((l, k) => text(l, ww / 2, hh * (k + 0.75) / (lines.length + 0.5), sizes[k] || sizes[sizes.length - 1], fg, k ? 'Arial, sans-serif' : 'Georgia, serif', k ? 'normal' : 'bold'));
  });
  notice('tower', 8, 0, 4, 2, '#1d2c22', '#efe6cc', ['Tower', 'Climb to the gallery', 'Adults £4', '127 steps — mind your head'], [30, 18, 20, 14]);
  notice('readers', 12, 0, 4, 2, '#f1ede2', '#1b2a4a', ['Radcliffe Camera', 'Reading room', 'Readers only', 'Please show your card'], [24, 18, 22, 15]);
  notice('divinity', 8, 2, 4, 2, '#16264f', '#e6c766', ['Divinity School', 'Open to visitors', 'Admission £1', 'Tours from the Great Gate'], [26, 17, 20, 15]);
  notice('turf', 12, 2, 4, 1, '#1f2a1c', '#f0d890', [tn('THE TURF TAVERN', 'THE BASTION')], [34]);
  notice('turfArrow', 12, 3, 4, 1, '#f3eee0', '#1f2a1c', [tn('The Turf Tavern  →', 'The Bastion  →')], [26]);
  notice('quiet', 8, 4, 4, 2, '#f1ede2', '#1b2a4a', ['Bodleian Library', 'Quiet please', 'No admittance', 'beyond this point'], [24, 20, 16, 16]);
  notice('allsouls', 12, 4, 4, 1, '#14161c', '#d8d0b8', ['ALL SOULS COLLEGE'], [26]);
  notice('degree', 8, 6, 4, 2, '#3b1420', '#f2e6c8', ['Degree Day', 'Graduands assemble', 'in the Divinity School', 'Guests by ticket only'], [26, 16, 16, 16]);
  notice('bnc', 12, 5, 4, 1, '#14161c', '#d8d0b8', ['BRASENOSE COLLEGE'], [24]);
  notice('tours', 8, 8, 4, 2, '#7a1c2c', '#f6eedc', ['Walking Tours', 'Guides wanted — today!', 'Four sights, six minutes', 'Tips are yours to keep'], [26, 17, 17, 15]);
  notice('mhs', 12, 6, 4, 1, '#14161c', '#e8e0c8', ['MUSEUM OF THE HISTORY OF SCIENCE'], [17]);
  // ---- ironwork (transparent ground): a railing panel of spear-headed bars, tiling sideways
  const IRON = '#15161a';
  put('rail', 0, 12, 4, 4, (gg, w, h) => {
    gg.clearRect(0, 0, w, h);
    const n = 8, sp = w / n;
    for (let i = 0; i < n; i++) { const x = (i + 0.5) * sp; gg.fillStyle = IRON; gg.fillRect(x - 3, 22, 6, h - 22); gg.beginPath(); gg.moveTo(x, 2); gg.lineTo(x + 7, 20); gg.lineTo(x, 28); gg.lineTo(x - 7, 20); gg.closePath(); gg.fill(); }
    gg.fillRect(0, 40, w, 8); gg.fillRect(0, h - 26, w, 8);
  });
  // a wrought-iron gate leaf with scrolls (All Souls' gate onto the square, the Schools' gates)
  put('gate', 4, 12, 4, 4, (gg, w, h) => {
    gg.clearRect(0, 0, w, h); gg.fillStyle = IRON; gg.strokeStyle = IRON;
    gg.fillRect(0, 0, 9, h); gg.fillRect(w - 9, 0, 9, h); gg.fillRect(0, 50, w, 8); gg.fillRect(0, h * 0.5, w, 8); gg.fillRect(0, h - 12, w, 12);
    for (let i = 1; i < 10; i++) { const x = (w * i) / 10; gg.fillRect(x - 2.5, 50, 5, h - 60); gg.beginPath(); gg.moveTo(x, 18); gg.lineTo(x + 6, 40); gg.lineTo(x - 6, 40); gg.fill(); gg.fillRect(x - 2, 36, 4, 16); }
    gg.lineWidth = 5; for (let i = 0; i < 4; i++) { const x = w * (0.125 + i * 0.25); gg.beginPath(); gg.arc(x, h * 0.5 - 30, 18, 0, TAU); gg.stroke(); gg.beginPath(); gg.arc(x, h * 0.5 + 34, 14, Math.PI, TAU); gg.stroke(); }
  });
  // a clock dial (St Mary's has none on the tower in 2013 — used for the Clarendon's? no: kept for the Sheldonian? unused)
  put('dial', 8, 12, 2, 2, (gg, w, h) => {
    gg.clearRect(0, 0, w, h); gg.fillStyle = '#e8e0c8'; gg.beginPath(); gg.arc(w / 2, h / 2, w / 2 - 4, 0, TAU); gg.fill(); gg.strokeStyle = '#222'; gg.lineWidth = 3; gg.stroke();
    gg.fillStyle = '#222'; for (let k = 0; k < 12; k++) { gg.save(); gg.translate(w / 2, h / 2); gg.rotate((k / 12) * TAU); gg.fillRect(-2, -w / 2 + 10, 4, 10); gg.restore(); }
  });
  // a camera-flash burst (photobomb gag)
  put('flash', 10, 12, 2, 2, (gg, w, h) => {
    gg.clearRect(0, 0, w, h); const gr = gg.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,240,0.7)'); gr.addColorStop(1, 'rgba(255,255,240,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, w, h);
  });
  // a reader's card (the Bod card) lying on a bench
  put('card', 12, 12, 2, 1, (gg, w, h) => {
    gg.fillStyle = '#f4f2ea'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#16264f'; gg.fillRect(0, 0, w, h * 0.3);
    gg.fillStyle = '#c9b48a'; gg.fillRect(8, h * 0.4, w * 0.25, h * 0.5); gg.fillStyle = '#333'; for (let k = 0; k < 3; k++) gg.fillRect(w * 0.36, h * (0.45 + k * 0.15), w * 0.5, 3);
  });
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, emissive: 0xfff0d8, emissiveMap: texture, emissiveIntensity: 0, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, name: 'rad-signs' });
  try { world.registerNight(material, 0.25); } catch { /* stub */ }
  SIGNS = { texture, material, uv: (n) => cells[n], cells };
  return SIGNS;
}

/**
 * The painted names over the doors of the Schools Quadrangle, as they are lettered on the doors today (the Latin is
 * KNOWN from photographs and the Bodleian's own guides; which door each sits on is mapped in _rad_bodleian.js).
 * '|' breaks a two-line board.
 */
export const SCHOOLS = [
  'SCHOLA MUSICAE', 'SCHOLA NATURALIS|PHILOSOPHIAE', 'SCHOLA MORALIS|PHILOSOPHIAE', 'SCHOLA GRAMMATICAE|ET HISTORIAE',
  'SCHOLA LINGUARUM', 'SCHOLA METAPHYSICAE', 'SCHOLA ASTRONOMIAE|ET RHETORICAE', 'SCHOLA GEOMETRIAE|ET ARITHMETICAE',
  'SCHOLA LOGICAE', 'SCHOLA MEDICINAE|ET ANATOMIAE', 'SCHOLA IURISPRUDENTIAE', 'SCHOLA THEOLOGIAE',
];

/** a quad in the sign material: corners a,b (bottom, left->right seen from the front) and height h, facing (nx,nz) */
export function signQuad(Bs, uv, x0, z0, x1, z1, y0, y1, nx, nz, off = 0.02) {
  const ox = nx * off, oz = nz * off;
  Bs.card('signs', [x0 + ox, y0, z0 + oz], [x1 + ox, y0, z1 + oz], [x1 + ox, y1, z1 + oz], [x0 + ox, y1, z0 + oz], uv);
}

/** merge plain geometry arrays (pos/uv) into a mesh in the sign material */
export function signsMesh(Bs, world, parent, what) {
  const S = radSigns(world);
  const meshes = Bs.build({ signs: S.material }, parent, { noShadow: true });
  for (const m of meshes) { m.name = 'rad:' + what + ':signs'; m.castShadow = false; }
  return meshes;
}

/** frustum-cull helper: compute bounding spheres and set matrixAutoUpdate off */
export function freeze(o) { o.traverse((m) => { if (m.isMesh && m.geometry && !m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); m.matrixAutoUpdate = false; m.updateMatrix(); }); return o; }

/** round shaft along Y in a Batch: n sides, radius r0 at y0 to r1 at y1 (smooth normals not available in Batch: faceted) */
export function shaft(B, key, x, z, r0, r1, y0, y1, n = 8) { B.cyl(key, x, y0, z, r1, y1 - y0, n, false, r0); }

/** ring wall (n-gon prism, inner face optional) in a Batch — returns nothing */
export function ringWall(B, key, cx, cz, r, y0, y1, n, a0 = 0, opts = {}) {
  for (let i = 0; i < n; i++) {
    const t0 = a0 + (i / n) * TAU, t1 = a0 + ((i + 1) / n) * TAU, tm = (t0 + t1) / 2;
    const p = (t, rr, y) => [cx + Math.sin(t) * rr, y, cz + Math.cos(t) * rr];
    const L = 2 * r * Math.sin(Math.PI / n);
    B.poly(key, [p(t0, r, y0), p(t1, r, y0), p(t1, r, y1), p(t0, r, y1)], [Math.sin(tm), 0, Math.cos(tm)], [[0, y0], [L, y0], [L, y1], [0, y1]]);
    if (opts.top) B.poly(key, [[cx, y1, cz], p(t0, r, y1), p(t1, r, y1)], [0, 1, 0]);
  }
}

/**
 * A plain masonry range on a mapped footprint, in the shared atlas (one draw with everything else): walls, a grid of
 * painted window units, string courses, battlements and a flat lead roof. Used instead of re-emitting a skipped city
 * building through world.makeBuilding (which would cost a draw call of its own in the city facade material).
 * rings: [outer, ...holes] (holes = courtyards: their walls face into the courtyard).
 * o: {h, storeys: [y0, y1, ...] (window rows: [bottom, top] pairs), win: key, winW, bay, wall, dress, crenel, pinnacles, arch}
 */
export function emitRange(B, rings, o) {
  const wall = o.wall || 'radHoney', dress = o.dress || 'radPale', h = o.h, bay = o.bay || 3.4, winW = o.winW || 1.6;
  let bayN = o.bay0 || 500;
  rings.forEach((ring, ri) => {
    if ((o.part === 'outer' && ri > 0) || (o.part === 'inner' && ri === 0)) return;
    // signed area: outer rings face out, holes face in (into the courtyard)
    let A = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; A += p[0] * q[1] - q[0] * p[1]; }
    const outSign = (A > 0 ? 1 : -1) * (ri === 0 ? 1 : -1);
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.2) continue;
      if (o.skipEdge && o.skipEdge(p, q)) continue;
      const ax = (q[0] - p[0]) / L, az = (q[1] - p[1]) / L;
      // outward normal: (az, -ax) for a CCW (A > 0, z down) ring
      const nx = az * outSign, nz = -ax * outSign;
      const flip = nx * -az + nz * ax < 0;            // frame local +z is (-az, ax)
      const F = frame((p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2, flip ? -ax : ax, flip ? -az : az);
      const nb = Math.floor((L - 0.6) / bay);
      // o.recess: real openings (the wall is a face with holes, reveals back to the glazing); else painted on the wall
      const holes = [];
      if (o.recess && nb >= 1 && o.storeys) for (let k = 0; k < nb; k++) {
        const x = -((nb - 1) * bay) / 2 + k * bay;
        for (let s = 0; s < o.storeys.length; s += 2) {
          if (o.skip && o.skip((p[0] + q[0]) / 2 + ax * x * (flip ? -1 : 1), (p[1] + q[1]) / 2 + az * x * (flip ? -1 : 1), s)) continue;
          holes.push({ x, s, pts: rectPts(x - winW / 2, o.storeys[s], x + winW / 2, o.storeys[s + 1]) });
        }
      }
      if (holes.length) { B.push(F); B.face(wall, rectPts(-L / 2, 0, L / 2, h), holes.map((q) => q.pts), 0); B.pop(); }
      else B.poly(wall, [[p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], h, q[1]], [p[0], h, p[1]]], [nx, 0, nz], [[0, 0], [L, 0], [L, h], [0, h]]);
      B.push(F);
      if (holes.length) {
        for (const hl of holes) {
          B.reveal(o.revealKey || wall, hl.pts, 0, -o.recess); B.unit(o.win || 'leaded', hl.pts, -o.recess, [bayN++ % 251 + 1, o.storeys[hl.s] < 4 ? 0 : 1]);
          const x0 = hl.pts[0][0], x1 = hl.pts[1][0], y0 = hl.pts[0][1], y1 = hl.pts[2][1];
          B.box(dress, (x0 + x1) / 2, y0 - 0.07, 0.07, x1 - x0 + 0.3, 0.14, 0.14, 0, { bottom: true });       // sill
          if (o.hood) B.box(dress, (x0 + x1) / 2, y1 + 0.16, 0.09, x1 - x0 + 0.5, 0.14, 0.18, 0, { bottom: true });   // hood (label) mould
          if (o.hood) for (const sx of [x0 - 0.2, x1 + 0.2]) B.box(dress, sx, y1 + 0.02, 0.09, 0.12, 0.3, 0.18, 0, { bottom: true });
        }
      }
      if (o.buttress && nb >= 1) {
        const [bw, bd, bh] = o.buttress;
        for (let k = 0; k <= nb; k++) {
          const x = -((nb - 1) * bay) / 2 + (k - 0.5) * bay; if (Math.abs(x) > L / 2 - bw / 2) continue;
          if (o.skip && o.skip((p[0] + q[0]) / 2 + ax * x * (flip ? -1 : 1), (p[1] + q[1]) / 2 + az * x * (flip ? -1 : 1), -1)) continue;
          B.box(wall, x, bh * 0.3, bd / 2, bw, bh * 0.6, bd, 0, { top: false });
          B.poly(dress, [[x - bw / 2, bh * 0.6, bd], [x + bw / 2, bh * 0.6, bd], [x + bw / 2, bh * 0.6 + 0.35, bd * 0.6], [x - bw / 2, bh * 0.6 + 0.35, bd * 0.6]], [0, 0.6, 1]);
          B.box(wall, x, bh * 0.6 + (bh * 0.4) / 2, bd * 0.3, bw, bh * 0.4, bd * 0.6, 0, { top: false });
          B.poly(dress, [[x - bw / 2, bh, bd * 0.6], [x + bw / 2, bh, bd * 0.6], [x + bw / 2, bh + 0.5, 0], [x - bw / 2, bh + 0.5, 0]], [0, 0.6, 1]);
        }
      }
      if (nb >= 1 && o.storeys && !holes.length) for (let k = 0; k < nb; k++) {
        const x = -((nb - 1) * bay) / 2 + k * bay;
        for (let s = 0; s < o.storeys.length; s += 2) {
          const y0 = o.storeys[s], y1 = o.storeys[s + 1];
          if (o.skip && o.skip((p[0] + q[0]) / 2 + ax * x * (flip ? -1 : 1), (p[1] + q[1]) / 2 + az * x * (flip ? -1 : 1), s)) continue;
          if (holes.length) continue;
          if (o.arch) B.unit(o.win || 'leaded', tudorPts(x, winW, y0, y1 - winW * 0.3, winW * 0.25, 6), 0.04, [bayN++ % 251 + 1, y0 < 4 ? 0 : 1]);
          else B.unit(o.win || 'leaded', rectPts(x - winW / 2, y0, x + winW / 2, y1), 0.04, [bayN++ % 251 + 1, y0 < 4 ? 0 : 1]);
          if (o.mullions) {
            // stone mullions and a transom over the glass, a frame round it and a hood mould over it (front faces only)
            const q = (x0, ya, x1, yb, z) => B.poly(dress, [[x0, ya, z], [x1, ya, z], [x1, yb, z], [x0, yb, z]], [0, 0, 1]);
            const n = o.mullions, w = 0.13;
            for (let m = 1; m < n; m++) { const mx = x - winW / 2 + (winW * m) / n; q(mx - w / 2, y0, mx + w / 2, y1, 0.07); }
            if (y1 - y0 > 2.2) { const ty = y0 + (y1 - y0) * 0.62; q(x - winW / 2, ty - w / 2, x + winW / 2, ty + w / 2, 0.07); }
            q(x - winW / 2 - 0.16, y0 - 0.16, x + winW / 2 + 0.16, y0, 0.06); q(x - winW / 2 - 0.16, y1, x + winW / 2 + 0.16, y1 + 0.16, 0.06);
            q(x - winW / 2 - 0.16, y0, x - winW / 2, y1, 0.06); q(x + winW / 2, y0, x + winW / 2 + 0.16, y1, 0.06);
            q(x - winW / 2 - 0.3, y1 + 0.22, x + winW / 2 + 0.3, y1 + 0.36, 0.1);
          }
        }
      }
      for (const y of o.strings || []) B.box(dress, 0, y, 0.06, L + 0.02, 0.22, 0.12, 0, { top: true });
      // parapet + battlements
      if (o.crenel) {
        B.box(dress, 0, h + 0.35, -0.15, L, 0.7, 0.35, 0, { top: true });
        const m = Math.max(1, Math.floor(L / 1.5));
        for (let k = 0; k < m; k++) B.box(dress, -L / 2 + (k + 0.5) * (L / m), h + 0.95, -0.15, (L / m) * 0.5, 0.5, 0.35, 0, { top: true });
      }
      if (o.pinnacles) { const n = Math.max(1, Math.round(L / o.pinnacles)); for (let k = 0; k < n; k++) { const x = -L / 2 + (k / n) * L; B.box(wall, x, h + 0.7, -0.2, 0.55, 1.4, 0.55, 0, { top: false }); B.cyl(wall, x, h + 1.4, -0.2, 0.02, 2.0, 4, false, 0.38); } }
      B.pop();
    }
  });
  if (o.part !== 'inner') flatUp(B, o.roof || 'radLead', rings[0], h, rings.slice(1));
  return bayN;
}

/** a flat polygon (concave ok, holes ok) at height y, facing up, UVs in metres: B.poly per triangle with an up hint */
export function flatUp(B, key, pts, y, holes = []) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
  const g = new THREE.ShapeGeometry(shape), pos = g.attributes.position, idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const P = [0, 1, 2].map((k) => [pos.getX(idx[i + k]), y, pos.getY(idx[i + k])]);
    B.poly(key, P, [0, 1, 0], P.map((p) => [p[0], p[2]]));
  }
  g.dispose();
}
