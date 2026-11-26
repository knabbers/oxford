// The two bronzes of the court by Gate 3 (places/worcester_snsc.js). Henry Moore's Reclining Figure (1982; on loan,
// installed 2023) and Elisabeth Frink's seated figure are real works under copyright: what stands here is NOT a copy of
// either, only a plain abstract mass of the right size and attitude (a reclining form with a raised end and an arch; a
// seated form), built from a few smooth tubes. One small mesh, its own dark bronze.
import * as THREE from 'three';

/** a smooth tube along a curve through `pts` [x, y, z] with radii `rad` (and an optional flattening [sideways, upright]) */
function tube(out, pts, rad, o = {}) {
  const N = o.n || 14, S = o.seg || 12, fx = (o.flat && o.flat[0]) || 1, fy = (o.flat && o.flat[1]) || 1;
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const base = out.pos.length / 3, up = new THREE.Vector3(), side = new THREE.Vector3(), tan = new THREE.Vector3(), p = new THREE.Vector3();
  const rAt = (t) => { const f = t * (rad.length - 1), i = Math.min(rad.length - 2, Math.floor(f)), k = f - i; return rad[i] + (rad[i + 1] - rad[i]) * (k * k * (3 - 2 * k)); };
  for (let i = 0; i <= N; i++) {
    const t = i / N; curve.getPoint(t, p); curve.getTangent(t, tan);
    side.set(0, 0, 1).cross(tan); if (side.lengthSq() < 0.01) side.set(1, 0, 0).cross(tan); side.normalize(); up.crossVectors(tan, side).normalize();
    const r = rAt(t) * (i === 0 || i === N ? 0.55 : 1);      // rounded ends
    for (let k = 0; k < S; k++) { const a = (k / S) * Math.PI * 2, c = Math.cos(a) * r * fx, s = Math.sin(a) * r * fy; out.pos.push(p.x + side.x * c + up.x * s, p.y + side.y * c + up.y * s, p.z + side.z * c + up.z * s); }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < S; k++) { const a = base + i * S + k, b = base + i * S + (k + 1) % S, c = a + S, d = b + S; out.idx.push(a, b, c, b, d, c); }
  // end caps: a point a little beyond each end
  for (const [i, sg] of [[0, -1], [N, 1]]) {
    const t = i / N; curve.getPoint(t, p); curve.getTangent(t, tan); const r = rAt(t) * 0.35, ci = out.pos.length / 3;
    out.pos.push(p.x + tan.x * r * sg, p.y + tan.y * r * sg, p.z + tan.z * r * sg);
    for (let k = 0; k < S; k++) { const a = base + i * S + k, b = base + i * S + (k + 1) % S; if (sg < 0) out.idx.push(ci, b, a); else out.idx.push(ci, a, b); }
  }
}
function slab(out, x0, x1, y0, y1, z0, z1) {
  const b = out.pos.length / 3;
  // (its own corners per face, so the plate's edges stay sharp)
  const F = [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]];
  F.forEach((f, i) => { for (const p of f) out.pos.push(p[0], p[1], p[2]); const k = b + i * 4; out.idx.push(k, k + 1, k + 2, k, k + 2, k + 3); });
}
/** the reclining form on its base plate: x along the plinth (the raised end at +x), y up from the plinth's top, z across */
function reclining(out) {
  slab(out, -1.33, 1.33, 0, 0.06, -0.44, 0.44);
  const y0 = 0.06;
  tube(out, [[-0.25, y0 + 0.2, 0.02], [0.2, y0 + 0.24, 0.0], [0.62, y0 + 0.42, -0.03], [0.92, y0 + 0.7, -0.05]], [0.2, 0.23, 0.25, 0.2], { flat: [1.15, 0.85] });      // the long mass, rising to one end
  tube(out, [[0.84, y0 + 0.62, -0.05], [0.96, y0 + 0.9, -0.04], [1.02, y0 + 1.16, -0.03]], [0.12, 0.08, 0.1], { n: 8, seg: 10 });                                  // a small knob over it
  tube(out, [[-0.2, y0 + 0.2, 0.1], [-0.55, y0 + 0.52, 0.14], [-0.82, y0 + 0.64, 0.15], [-1.02, y0 + 0.36, 0.16], [-1.12, y0 + 0.07, 0.17]], [0.16, 0.15, 0.13, 0.1, 0.07]);      // an arch at the other end
  tube(out, [[-0.25, y0 + 0.16, -0.14], [-0.62, y0 + 0.36, -0.18], [-0.95, y0 + 0.2, -0.2], [-1.1, y0 + 0.06, -0.2]], [0.14, 0.13, 0.1, 0.07]);                    // ... and a lower one beside it
  tube(out, [[0.82, y0 + 0.6, 0.2], [0.62, y0 + 0.3, 0.3], [0.5, y0 + 0.07, 0.3]], [0.09, 0.075, 0.06], { n: 8, seg: 10 });                                         // a prop to the plate
}
/** the seated form: x forwards, y up from the plinth's top */
function seated(out, s) {
  tube(out, [[-0.05, 0.14, 0], [-0.06, 0.45, 0], [-0.02, 0.78, 0]], [0.17, 0.15, 0.13].map((r) => r * s / 0.36), { n: 8, flat: [1.2, 0.8] });
  tube(out, [[-0.01, 0.86, 0], [0.0, 1.0, 0]], [0.06, 0.085], { n: 5, seg: 10 });
  for (const z of [-0.11, 0.11]) tube(out, [[-0.02, 0.16, z], [0.3, 0.2, z * 1.1], [0.36, 0.0, z * 1.1], [0.36, -0.3, z * 1.1]], [0.085, 0.075, 0.06, 0.05], { n: 10, seg: 10 });
}
function geometry(out) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3)); g.setIndex(out.idx); g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
/** both bronzes as one mesh in world coordinates. moore: { x, y, z, ux, uz } (the plinth's top; u = its long axis, the raised end that way); frink: { x, y, z, h (heading, rad), s } */
export function buildBronzes(moore, frink) {
  const all = { pos: [], idx: [] };
  const place = (fn, x, y, z, ax, az) => {
    const o = { pos: [], idx: [] }; fn(o);
    const b = all.pos.length / 3;
    for (let i = 0; i < o.pos.length; i += 3) { const lx = o.pos[i], ly = o.pos[i + 1], lz = o.pos[i + 2]; all.pos.push(x + lx * ax - lz * az, y + ly, z + lx * az + lz * ax); }
    for (const i of o.idx) all.idx.push(b + i);
  };
  place(reclining, moore.x, moore.y, moore.z, moore.ux, moore.uz);
  if (frink) place((o) => seated(o, frink.s), frink.x, frink.y, frink.z, Math.cos(frink.h), Math.sin(frink.h));
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a4f47, roughness: 0.42, metalness: 0.35 }); mat.name = 'snsc-bronze';
  const mesh = new THREE.Mesh(geometry(all), mat);
  mesh.name = 'worcester:snsc-bronze'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  return mesh;
}
