// Interior kit: quick rooms (floor, walls with door gaps, ceiling, optional brick vault), materials and simple
// furniture for the interiors that other modules build (pubs, halls, libraries, JCRs...). All UVs in metres.
// Every builder returns a THREE.Group already added to `scene` (static: matrixAutoUpdate off) and, if a Collider is
// given, adds matching collision.
import * as THREE from 'three';
import { metricBox, makeStatic } from './util.js';

export function createInteriorKit(mats) {
  const M = (m) => (typeof m === 'string' ? mats[m] || mats.plaster : m || mats.plaster);
  const mesh = (geo, mat, x, y, z, ry = 0, shadow = false) => {
    const m = new THREE.Mesh(geo, M(mat)); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = shadow; m.receiveShadow = true; return m;
  };
  const place = (scene, obj, x = 0, z = 0, rot = 0, y = 0) => { obj.position.set(x, y, z); obj.rotation.y = rot; scene.add(obj); makeStatic(obj); return obj; };
  const boxAt = (g, w, h, d, mat, x, y, z) => { const m = mesh(metricBox(w, h, d), mat, x, y + h / 2, z); g.add(m); return m; };
  const collideBox = (col, x, z, w, d, rot) => { if (col) col.addBox(x, z, w, d, rot || 0); };
  let vaultMat = null;

  /** Floor slab top at y (default 0). */
  function floor(scene, { x = 0, z = 0, w = 6, d = 6, y = 0, mat = 'wood' } = {}) {
    const g = new THREE.Group(); boxAt(g, w, 0.1, d, mat, 0, y - 0.1, 0); return place(scene, g, x, z);
  }
  function ceiling(scene, { x = 0, z = 0, w = 6, d = 6, y = 3.2, mat = 'plaster' } = {}) {
    const g = new THREE.Group(); boxAt(g, w, 0.12, d, mat, 0, y, 0); return place(scene, g, x, z);
  }
  /**
   * Straight wall from (x0,z0) to (x1,z1), height h, thickness t, with door/arch gaps:
   * doors: [{at: metres from start to the gap centre, width, height}]
   */
  function wall(scene, { x0, z0, x1, z1, h = 3.2, t = 0.2, mat = 'plaster', doors = [], collider = null, y = 0, skirting = 'darkWood' }) {
    const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), g = new THREE.Group();
    // (walk-in rooms: `sill` > 0 makes the gap a window — wall below it, and solid to walk into; `solid: true` keeps the
    //  collider across a doorway whose way through is a seamless portal's passage — core/interiors.js)
    const ds = doors.map((d) => ({ a: d.at - (d.width || 1.1) / 2, b: d.at + (d.width || 1.1) / 2, h: d.height || 2.2, sill: d.sill || 0, solid: !!d.solid || d.sill > 0 })).sort((p, q) => p.a - q.a);
    let s = 0;
    const seg = (a, b, y0, y1) => { if (b - a < 0.01 || y1 - y0 < 0.01) return; const m = mesh(metricBox(b - a, y1 - y0, t), mat, (a + b) / 2 - L / 2, y + (y0 + y1) / 2, 0); g.add(m); };
    const solid = [];
    const shut = [];
    for (const d of ds) { seg(s, d.a, 0, h); solid.push([s, d.a]); seg(d.a, d.b, d.h, h); if (d.sill) seg(d.a, d.b, 0, Math.min(d.sill, h)); if (d.solid) shut.push([d.a, d.b]); s = d.b; }
    seg(s, L, 0, h); solid.push([s, L]);
    if (skirting) for (const [a, b] of solid) if (b - a > 0.05) for (const side of [-1, 1]) g.add(mesh(metricBox(b - a, 0.14, 0.02), skirting, (a + b) / 2 - L / 2, y + 0.07, side * (t / 2 + 0.01)));
    g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); g.rotation.y = -ang; scene.add(g); makeStatic(g);
    if (collider) for (const [a, b] of solid) if (b - a > 0.05) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      collider.addSegment(x0 + ca * a, z0 + sa * a, x0 + ca * b, z0 + sa * b, { tag: 'wall' });
    }
    if (collider) for (const [a, b] of shut) { const ca = Math.cos(ang), sa = Math.sin(ang); collider.addSegment(x0 + ca * a, z0 + sa * a, x0 + ca * b, z0 + sa * b, { tag: 'wall' }); }
    return g;
  }
  /**
   * Rectangular room centred at (x,z): w (x extent) × d (z extent) × h.
   * doors: [{wall:'n'|'s'|'e'|'w', at: offset from wall centre (m), width, height}]
   * vault: true -> brick barrel-vault ceiling (cellar bars). wainscot: material for lower 1.1 m panelling.
   * Returns the array of created objects (already in the scene).
   */
  function room(scene, { x = 0, z = 0, w = 8, d = 6, h = 3.2, floor: fm = 'wood', walls = 'plaster', ceiling: cm = 'plaster', doors = [], collider = null, vault = false, wainscot = null, t = 0.2 } = {}) {
    const hw = w / 2, hd = d / 2, parts = [];
    parts.push(floor(scene, { x, z, w: w + t * 2, d: d + t * 2, mat: fm }));
    const sides = { n: [x - hw, z - hd, x + hw, z - hd, w], s: [x + hw, z + hd, x - hw, z + hd, w], e: [x + hw, z - hd, x + hw, z + hd, d], w: [x - hw, z + hd, x - hw, z - hd, d] };
    for (const k of ['n', 's', 'e', 'w']) {
      const [x0, z0, x1, z1, L] = sides[k];
      const ds = doors.filter((o) => o.wall === k).map((o) => ({ at: L / 2 + (o.at || 0) * (k === 's' || k === 'w' ? -1 : 1), width: o.width, height: o.height, sill: o.sill, solid: o.solid }));
      parts.push(wall(scene, { x0, z0, x1, z1, h, t, mat: walls, doors: ds, collider }));
      if (wainscot) {
        const ox = ((z1 - z0) / L) * (t / 2 + 0.02), oz = (-(x1 - x0) / L) * (t / 2 + 0.02); // outward offset; subtract to move inside
        parts.push(wall(scene, { x0: x0 - ox, z0: z0 - oz, x1: x1 - ox, z1: z1 - oz, h: 1.1, t: 0.03, mat: wainscot, doors: ds.map((q) => ({ ...q, height: q.sill ? q.height : 1.2 })), skirting: null }));
      }
    }
    if (vault) {
      const g = new THREE.CylinderGeometry(hw, hw, d, 18, 1, true, -Math.PI / 2, Math.PI);
      g.rotateX(Math.PI / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * hw, uv.getY(i) * d);
      if (!vaultMat) { vaultMat = M('brick').clone(); vaultMat.side = THREE.DoubleSide; }
      const m = new THREE.Mesh(g, vaultMat); m.position.set(x, h, z); m.scale.y = 0.6; m.receiveShadow = true;
      scene.add(m); makeStatic(m); parts.push(m);
    } else parts.push(ceiling(scene, { x, z, w: w + t * 2, d: d + t * 2, y: h, mat: cm }));
    return parts;
  }

  // ---- furniture (origin at floor, facing +z) ----
  function table(scene, { x = 0, z = 0, rot = 0, w = 1.4, d = 0.8, h = 0.76, mat = 'darkWood', collider = null } = {}) {
    const g = new THREE.Group();
    boxAt(g, w, 0.05, d, mat, 0, h - 0.05, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(g, 0.06, h - 0.05, 0.06, mat, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06));
    collideBox(collider, x, z, w, d, rot);
    return place(scene, g, x, z, rot);
  }
  function chair(scene, { x = 0, z = 0, rot = 0, mat = 'darkWood', seat = 0.46 } = {}) {
    const g = new THREE.Group();
    boxAt(g, 0.44, 0.05, 0.44, mat, 0, seat - 0.05, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxAt(g, 0.04, seat - 0.05, 0.04, mat, sx * 0.19, 0, sz * 0.19);
    boxAt(g, 0.44, 0.5, 0.04, mat, 0, seat, -0.2);
    return place(scene, g, x, z, rot);
  }
  function stool(scene, { x = 0, z = 0, h = 0.75, mat = 'darkWood' } = {}) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), M(mat)); top.position.y = h - 0.025; g.add(top);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; boxAt(g, 0.035, h - 0.05, 0.035, mat, Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12); }
    return place(scene, g, x, z);
  }
  /** Long bench (college hall / pub settle). back: true for a settle. */
  function bench(scene, { x = 0, z = 0, rot = 0, w = 2.4, d = 0.38, seat = 0.45, back = false, mat = 'darkWood', collider = null } = {}) {
    const g = new THREE.Group();
    boxAt(g, w, 0.05, d, mat, 0, seat - 0.05, 0);
    for (const sx of [-1, 1]) boxAt(g, 0.05, seat - 0.05, d - 0.04, mat, sx * (w / 2 - 0.1), 0, 0);
    if (back) boxAt(g, w, 0.9, 0.05, mat, 0, seat, -d / 2);
    collideBox(collider, x, z, w, d, rot);
    return place(scene, g, x, z, rot);
  }
  /** Bar counter with a top and a back shelf of bottles. Front faces +z. */
  function barCounter(scene, { x = 0, z = 0, rot = 0, w = 4, d = 0.7, h = 1.05, mat = 'darkWood', top = 'brass', backShelf = true, collider = null } = {}) {
    const g = new THREE.Group();
    boxAt(g, w, h - 0.05, d, M('panelling'), 0, 0, 0);
    boxAt(g, w + 0.1, 0.05, d + 0.12, mat, 0, h - 0.05, 0.02);
    boxAt(g, w, 0.05, 0.05, top, 0, 0.2, d / 2 + 0.06); // foot rail
    if (backShelf) {
      boxAt(g, w, 2.0, 0.3, mat, 0, 0, -d / 2 - 1.0);
      const bottleGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.3, 6);
      const cols = [0x1d4a1d, 0x5a2a0a, 0xcfd8d0, 0x6a1010, 0x8a6a1a];
      for (let r = 0; r < 2; r++) for (let i = 0; i < Math.floor(w / 0.12); i++) {
        const b = new THREE.Mesh(bottleGeo, new THREE.MeshStandardMaterial({ color: cols[(i * 7 + r * 3) % cols.length], roughness: 0.15, metalness: 0.1 }));
        b.position.set(-w / 2 + 0.08 + i * 0.12, 1.0 + r * 0.55 + 0.15, -d / 2 - 0.95); g.add(b);
      }
      for (let r = 0; r < 2; r++) boxAt(g, w, 0.03, 0.28, mat, 0, 0.98 + r * 0.55, -d / 2 - 0.95);
    }
    collideBox(collider, x, z, w, d, rot);
    return place(scene, g, x, z, rot);
  }
  function shelf(scene, { x = 0, z = 0, rot = 0, w = 1.2, h = 1.8, d = 0.35, shelves = 4, mat = 'darkWood', collider = null } = {}) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) boxAt(g, 0.03, h, d, mat, sx * (w / 2 - 0.015), 0, 0);
    for (let i = 0; i <= shelves; i++) boxAt(g, w, 0.03, d, mat, 0, (i * (h - 0.03)) / shelves, 0);
    boxAt(g, w, h, 0.02, mat, 0, 0, -d / 2 + 0.01);
    collideBox(collider, x, z, w, d, rot);
    return place(scene, g, x, z, rot);
  }
  function bookcase(scene, { x = 0, z = 0, rot = 0, w = 1.8, h = 2.4, d = 0.4, mat = 'darkWood', collider = null } = {}) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) boxAt(g, 0.05, h, d, mat, sx * (w / 2 - 0.025), 0, 0);
    boxAt(g, w, 0.06, d, mat, 0, h - 0.06, 0); boxAt(g, w, 0.1, d, mat, 0, 0, 0);
    const books = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.2), M('books'));
    // books texture: 1 repeat = 2 m with 4 shelves -> scale plane uvs in metres
    const uv = books.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w - 0.1), uv.getY(i) * (h - 0.2));
    books.position.set(0, h / 2, -d / 2 + 0.12); g.add(books);
    boxAt(g, w, h, 0.02, mat, 0, 0, -d / 2 + 0.01);
    collideBox(collider, x, z, w, d, rot);
    return place(scene, g, x, z, rot);
  }
  /** Warm interior light: PointLight + a small glowing shade so the source is visible. */
  function warmLight(scene, { x = 0, y = 2.6, z = 0, intensity = 6, distance = 9, color = 0xffc98a, shade = true, shadow = false } = {}) {
    const l = new THREE.PointLight(color, intensity, distance, 1.6); l.position.set(x, y, z); l.castShadow = shadow; scene.add(l);
    if (shade) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff1d8, emissive: color, emissiveIntensity: 2.5 }));
      s.position.set(x, y + 0.05, z); scene.add(s); makeStatic(s);
    }
    return l;
  }
  function spot(scene, { x = 0, y = 3, z = 0, tx = 0, ty = 0, tz = 0, intensity = 20, angle = 0.6, distance = 14, color = 0xfff0d8 } = {}) {
    const l = new THREE.SpotLight(color, intensity, distance, angle, 0.5, 1.5); l.position.set(x, y, z); l.target.position.set(tx, ty, tz); scene.add(l); scene.add(l.target); return l;
  }
  /** Fireplace with glowing embers (pubs, JCRs). */
  function fireplace(scene, { x = 0, z = 0, rot = 0, w = 1.6, collider = null } = {}) {
    const g = new THREE.Group();
    boxAt(g, w, 1.2, 0.4, 'stone', 0, 0, 0); boxAt(g, w + 0.3, 0.1, 0.5, 'darkWood', 0, 1.2, 0.02);
    const hole = boxAt(g, w * 0.6, 0.75, 0.05, 'blackPaint', 0, 0.05, 0.19); void hole;
    const ember = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, 0.12, 0.2), new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff5a10, emissiveIntensity: 2 }));
    ember.position.set(0, 0.12, 0.12); g.add(ember);
    const l = new THREE.PointLight(0xff7a30, 3, 6, 1.8); l.position.set(0, 0.5, 0.6); g.add(l);
    collideBox(collider, x, z, w, 0.5, rot);
    return place(scene, g, x, z, rot);
  }
  return { mats, room, floor, ceiling, wall, table, chair, stool, bench, barCounter, shelf, bookcase, fireplace, warmLight, spot, box: metricBox };
}
