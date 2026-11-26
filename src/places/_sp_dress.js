// South Park — the park itself, by day and on ordinary nights (the fireworks night is south_park.js + _sp_build.js).
// The world already draws the grass, the woods, the paths, the mapped fences, benches and bins. This adds:
//   preMapPark   (before the world is built) iron railings along the stretches of the boundary the map leaves open —
//                Headington Road / London Place and the west end of Morrell Avenue — and turns the mapped boundary
//                fences into railings, all as ordinary map barriers: drawn, collided and distance-culled by the world
//   buildPark    gate piers at the three entrances, a name board, the open centre of the field (scattered trees
//                cleared), the skyline, and a little daytime life (two friends kicking a ball about, someone flying a
//                kite) on the shared clock. Dog walkers and joggers come from systems/pedestrians.js: a named park is
//                a park zone.
// (2026-11: the hill is now drawn — world/terrain.js lifts what is drawn, the game's ground stays flat — so with it on
// the skyline below keeps a fixed height; the rest of this note describes ?terrain=0.)
// THE GROUND IS FLAT. The real South Park climbs ~30 m from St Clement's to Warneford Lane and that climb is what
// gives the view of the spires; the game models Oxford flat (world.groundHeight is 0-0.13 m everywhere) and this
// module does not fake terrain. Instead the skyline "rises" as you walk up the park: a single mesh of the famous
// towers at their true map positions, drawn taller and paler than life and grown from nothing as the player moves east
// from the bottom of the park to the top — the view opening as you climb, without a hill.
import * as THREE from 'three';
import { createCharacter, randomLook } from '../core/characters.js';
import { SITE, hash, smooth } from './_sp_show.js';
import { VB } from './_sp_build.js';
import { planter, plantAlong, growAlong } from './_se_trees.js';
import { EASTPASS } from '../world/terrain.js';

export const PARK_ID = SITE.park;
const BOUNDARY_FENCES = ['w52833484', 'w887308654', 'w903199164'];   // mapped as barrier=fence: Morrell Avenue side, Cheney Lane side
const dseg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - ax - dx * t, pz - az - dz * t); };

/** Pure: the railing runs to add for a map — [{id, kind, h, pts}] (deterministic; also used by the smoke test). */
export function railingRuns(map) {
  const park = map.areas.find((a) => a.id === PARK_ID); if (!park) return [];
  const P = park.poly, bb = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [x, z] of P) { bb[0] = Math.min(bb[0], x); bb[1] = Math.max(bb[1], x); bb[2] = Math.min(bb[2], z); bb[3] = Math.max(bb[3], z); }
  const near = (pts) => pts.some(([x, z]) => x > bb[0] - 30 && x < bb[1] + 30 && z > bb[2] - 30 && z < bb[3] + 30);
  const bars = map.barriers.filter((b) => near(b.pts)), ways = map.roads.filter((r) => near(r.pts));
  const blocked = (x, z) => {
    for (const b of bars) for (let i = 0; i < b.pts.length - 1; i++) if (dseg(x, z, b.pts[i][0], b.pts[i][1], b.pts[i + 1][0], b.pts[i + 1][1]) < 5) return true;
    for (const r of ways) { const reach = r.w / 2 + 2.2; for (let i = 0; i < r.pts.length - 1; i++) if (dseg(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]) < reach) return true; }
    for (const [gx, gz] of SITE.gates) if (Math.hypot(x - gx, z - gz) < 7) return true;
    return false;
  };
  const runs = []; let cur = null;
  const flush = () => { if (cur && cur.length > 1) { let len = 0; for (let i = 1; i < cur.length; i++) len += Math.hypot(cur[i][0] - cur[i - 1][0], cur[i][1] - cur[i - 1][1]); if (len >= 8) runs.push(cur); } cur = null; };
  const samples = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 3));
    for (let k = 0; k < n; k++) { const f = k / n, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; samples.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10, blocked(x, z)]); }
  }
  let start = samples.findIndex((q) => q[2]); if (start < 0) start = 0;
  for (let i = 0; i < samples.length; i++) { const q = samples[(start + i) % samples.length]; if (q[2]) flush(); else (cur || (cur = [])).push([q[0], q[1]]); }
  flush();
  // (the samples inside one straight polygon edge collapse to its ends: simplify keeps only the corners)
  return runs.map((pts, i) => ({ id: 'sp-rail-' + i, kind: 'railing', h: 1.25, pts: simplify(pts) }));
}
function simplify(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) { const a = out[out.length - 1], b = pts[i], c = pts[i + 1]; if (dseg(b[0], b[1], a[0], a[1], c[0], c[1]) > 0.25) out.push(b); }
  out.push(pts[pts.length - 1]);
  return out;
}

export function preMapPark(game) {
  const map = game.map; if (!map || map._spDressed) return;
  map._spDressed = true;
  for (const b of map.barriers) if (BOUNDARY_FENCES.includes(b.id)) { b.kind = 'railing'; b.h = 1.3; }
  for (const r of railingRuns(map)) map.barriers.push(r);
  // photo comparison east (2026-11): Morrell Avenue is a tunnel of big trees — the mapped avenue trees are grown to
  // 17-23 m (19 m and over draw as planes) and the gaps filled; a line of trees along the park's Morrell Avenue edge
  if (EASTPASS) try {
    const MA = [[1560, 446], [1637, 486], [1704, 537], [1748, 564], [1807, 581], [1887, 586], [1969, 587], [2036, 582], [2180, 564], [2258, 552], [2388, 495], [2425, 479]];
    const grown = growAlong(map, MA, 15, 17, 23, 5), P = planter(map, [1540, 2440, 420, 610]);
    const added = plantAlong(P, MA, [-8.6, 8.6], 15, 17, 23, 7, { jitter: 0.8, gap: 8 });
    Object.defineProperty(map, '_spTrees', { value: { grown, added }, enumerable: false });
  } catch (e) { console.error('[south_park] trees', e); }
}

// ------------------------------------------------------------------------------------------------ skyline
// [name, x, z, kind, width m, height m] — true map positions (map.json / world/landmarks.js); heights approximate
export const SKYLINE = [
  ['Magdalen Tower', 905.6, 362.5, 'tower', 8.5, 44], ['St Mary the Virgin', 418, 243, 'spire', 8, 62], ['Radcliffe Camera', 413.5, 170.6, 'dome', 30, 46],
  ['All Souls', 492, 172, 'twin', 4.5, 34], ['Sheldonian', 342.4, 72.8, 'cupola', 22, 26], ['New College bell tower', 523.4, 46.2, 'tower', 7, 31],
  ['Merton Chapel', 505.1, 435.5, 'tower', 10, 36], ['Christ Church Cathedral', 372.8, 538.7, 'spire', 7, 46], ['Tom Tower', 237.5, 530.4, 'ogee', 9, 46],
  ['All Saints (Lincoln library)', 295.5, 285.7, 'spire', 6, 48], ['Nuffield', -161.8, 274.8, 'spire', 7, 46],
];
const SKY_V = 3.4, SKY_H = 2.4, HILL_SKY = 1.5;
function buildSkyline() {
  const vb = new VB(), c = 0xffffff;
  for (const [, x, z, kind, w0, h] of SKYLINE) {
    const w = w0 * SKY_H;
    vb.at(x, z, 0.35);
    if (kind === 'tower') { vb.box(w, h * 0.93, w, 0, 0, 0, c); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) vb.cyl(0, w * 0.1, h * 0.12, 4, sx * w * 0.42, h * 0.93, sz * w * 0.42, c); }
    else if (kind === 'spire') { vb.box(w, h * 0.45, w, 0, 0, 0, c); vb.cyl(0, w * 0.55, h * 0.55, 8, 0, h * 0.45, 0, c); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) vb.cyl(0, w * 0.12, h * 0.14, 4, sx * w * 0.42, h * 0.45, sz * w * 0.42, c); }
    else if (kind === 'dome') { vb.cyl(w * 0.5, w * 0.52, h * 0.36, 16, 0, 0, 0, c); vb.cyl(w * 0.37, w * 0.39, h * 0.2, 16, 0, h * 0.36, 0, c); vb.add(new THREE.SphereGeometry(w * 0.36, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, 0, h * 0.56, 0); vb.cyl(w * 0.05, w * 0.06, h * 0.12, 8, 0, h * 0.56 + w * 0.34, 0, c); }
    else if (kind === 'twin') { for (const dz of [-9, 9]) { vb.box(w, h * 0.72, w, 0, 0, dz, c); vb.cyl(0, w * 0.5, h * 0.28, 8, 0, h * 0.72, dz, c); } }
    else if (kind === 'cupola') { vb.box(w, h * 0.55, w * 1.3, 0, 0, 0, c); vb.cyl(w * 0.14, w * 0.16, h * 0.25, 8, 0, h * 0.55, 0, c); vb.add(new THREE.SphereGeometry(w * 0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, 0, h * 0.8, 0); }
    else if (kind === 'ogee') { vb.box(w, h * 0.55, w, 0, 0, 0, c); vb.cyl(w * 0.4, w * 0.45, h * 0.2, 8, 0, h * 0.55, 0, c); vb.add(new THREE.SphereGeometry(w * 0.42, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, 0, h * 0.75, 0); vb.cyl(0, w * 0.08, h * 0.14, 6, 0, h * 0.75 + w * 0.38, 0, c); }
  }
  // the mass of the city under the towers: a low broken roofline (colleges, the Bodleian, Christ Church)
  for (let i = 0; i < 26; i++) {
    const x = 260 + hash(i, 11) * 640, z = 70 + hash(i, 23) * 500, w = 34 + hash(i, 5) * 50, h = 13 + hash(i, 7) * 11;
    vb.at(x, z, hash(i, 3) * 3); vb.box(w, h, w * (0.4 + hash(i, 9) * 0.5), 0, 0, 0, c);
    if (i % 3 === 0) vb.add(new THREE.ConeGeometry(w * 0.36, h * 0.5, 4), c, 0, 0, h * 1.25, 0, Math.PI / 4);
  }
  const g = vb.geometry(); g.deleteAttribute('aGlow'); g.deleteAttribute('color');
  const mat = new THREE.MeshBasicMaterial({ color: 0x8a94a8, fog: false });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'southpark:skyline'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.visible = false;
  return { mesh, mat, tris: vb.tris };
}

// ------------------------------------------------------------------------------------------------ install
export function buildPark(game) {
  const W = game.world, col = game.worldCollider, scene = game.worldScene, map = game.map;
  const park = map.areas.find((a) => a.id === PARK_ID);
  const out = { park: park ? park.poly : null, cleared: 0, tris: 0, draws: 0 };
  if (!park) return out;
  const inPark = (x, z) => W.util.pointInPoly(x, z, park.poly);
  out.inPark = inPark;

  // the open middle of the lower park: no scattered trees where the fair, the fire and the crowd stand (the mapped
  // tree line across the park and the mapped clumps are left alone)
  const [fx, fz] = SITE.fair, [bx, bz] = SITE.bonfire, [lx, lz] = SITE.launch, C = SITE.crowd;
  for (const poly of [[[fx - 46, fz - 38], [fx + 50, fz - 38], [fx + 50, fz + 40], [fx - 46, fz + 40]],
    [[bx - 76, bz - 30], [bx + 30, bz - 30], [bx + 30, bz + 52], [bx - 76, bz + 52]],
    [[C[0][0] - 4, C[0][1] + 6], [C[1][0] + 4, C[1][1] + 6], [C[2][0] + 4, C[2][1] + 3], [C[3][0] - 4, C[3][1] + 3]],
    [[lx - 30, lz - 44], [lx + 30, lz - 44], [lx + 30, lz + 44], [lx - 30, lz + 44]],
    // the open spine of the park, bottom to top (the real slope is open grass: the trees stand round the edges and in a
    // few clumps) — it is also the sight line from the top towards the city
    [[1700, 412], [2330, 412], [2330, 478], [2100, 505], [1700, 512]]]) {
    try { out.cleared += W.clearArea(poly, { trees: true, furniture: false, lamps: false }); } catch { /* optional */ }
  }

  // gate piers + open iron leaves at the three entrances, one small mesh each (culled when far by core/cull.js)
  const lamb = new THREE.MeshLambertMaterial({ vertexColors: true });
  SITE.gates.forEach(([x, z, h], gi) => {
    const vb = new VB(); vb.at(x, z, h);
    for (const sx of [-2.3, 2.3]) {
      vb.box(0.62, 2.1, 0.62, sx, 0, 0, 0xcdbb8c); vb.box(0.78, 0.14, 0.78, sx, 2.1, 0, 0xd8c79a); vb.add(new THREE.SphereGeometry(0.24, 8, 6), 0xd8c79a, 0, sx, 2.46, 0);
      // leaf folded back into the park, bars
      const s = Math.sign(sx);
      vb.box(0.05, 0.05, 2.0, sx + s * 0.1, 1.5, 1.25, 0x1c1f22); vb.box(0.05, 0.05, 2.0, sx + s * 0.1, 0.2, 1.25, 0x1c1f22);
      for (let i = 0; i < 9; i++) vb.box(0.03, 1.45, 0.03, sx + s * 0.1, 0.2, 0.35 + i * 0.23, 0x1c1f22);
      const c = Math.cos(h), sn = Math.sin(h); col.addCircle(x + sx * c, z - sx * sn, 0.42, { tag: 'gatepost' });
    }
    const g = vb.geometry(); g.deleteAttribute('aGlow');
    const m = new THREE.Mesh(g, lamb); m.name = 'southpark:gate' + gi; m.castShadow = true; m.receiveShadow = true; W.addStatic(m);
    out.tris += vb.tris; out.draws++;
  });
  // name board by the Morrell Avenue gate
  try {
    const [x, z, h] = SITE.gates[0], t = W.tex.sign('SOUTH PARK', { bg: '#1f3a2a', fg: '#efe6c8' });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
    const c = Math.cos(h), s = Math.sin(h); board.position.set(x + 5.2 * c + 1.2 * s, 1.55, z - 5.2 * s + 1.2 * c); board.rotation.y = h + Math.PI; board.name = 'southpark:board';
    const posts = new VB(); posts.at(board.position.x, board.position.z, h); for (const sx of [-1.0, 1.0]) posts.box(0.08, 1.9, 0.08, sx, 0, 0, 0x1f3a2a);
    const pg = posts.geometry(); pg.deleteAttribute('aGlow');
    W.addStatic(board); W.addStatic(new THREE.Mesh(pg, lamb)); out.draws += 2; out.tris += 2 + posts.tris;
  } catch { /* optional */ }

  // ---- skyline
  const sky = buildSkyline(); scene.add(sky.mesh); out.skyline = sky; out.tris += sky.tris;
  const fogC = new THREE.Color(), stone = new THREE.Color(0.2, 0.215, 0.29), dusk = new THREE.Color(0.035, 0.04, 0.065);   // a blue-grey silhouette by day, near-black against the afterglow
  let skyK = -1;
  /** px, pz = player; returns the skyline's growth 0..1 */
  out.updateSkyline = (px, pz) => {
    // hills (world/terrain.js): the park really climbs now, so the far towers no longer grow out of the ground — they
    // stand at a fixed, mildly exaggerated height and simply come into view over the trees as you gain height (they
    // are beyond the city's own draw distance from here, which is why this mesh still stands in for them)
    const hill = W.terrain && W.terrain.on ? W.terrainHeight(px, pz) : -1;
    const grow = px > 1700 && px < 2700 && pz > 150 && pz < 640 && inPark(px, pz) ? (hill >= 0 ? (hill > 3 ? HILL_SKY / SKY_V : 0) : smooth(1760, 2060, px)) : 0;
    if (grow <= 0.001) { if (sky.mesh.visible) sky.mesh.visible = false; skyK = -1; return 0; }
    sky.mesh.visible = true;
    if (Math.abs(grow - skyK) > 0.004) { skyK = grow; sky.mesh.scale.set(1, SKY_V * grow, 1); sky.mesh.updateMatrix(); }
    // a pale silhouette: the horizon haze with a little of the stone left in it by day, darker than the sky at night
    const f = scene.fog ? fogC.copy(scene.fog.color) : fogC.set(0x9fb4cc), day = game.time.daylight;
    sky.mat.color.copy(dusk).lerp(stone, day).lerp(f, 0.18);
    return grow;
  };
  sky.mesh.matrixAutoUpdate = false;

  // ---- daytime life: a kickabout and a kite (shared clock; made the first time the player is near, by day)
  const life = { made: false, chars: [], ball: null, kite: null, on: false };
  const KICK = [[1962, 452], [1976, 446]], KITE = [2030, 474];
  function makeLife() {
    life.made = true;
    const mk = (seed, x, z, extra) => { const ch = createCharacter({ ...randomLook(seed, { outfit: 'casual' }), ...extra }); ch.group.position.set(x, W.groundHeight(x, z), z); scene.add(ch.group); life.chars.push(ch); return ch; };
    mk(4401, KICK[0][0], KICK[0][1], { topStyle: 'tshirt', legs: 'shorts' }); mk(4402, KICK[1][0], KICK[1][1], { topStyle: 'hoodie' }); mk(4403, KITE[0], KITE[1], {});
    life.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 })); life.ball.name = 'southpark:ball'; scene.add(life.ball);
    const kg = new VB(); kg.at(0, 0, 0); kg.add(new THREE.ConeGeometry(0.55, 0.9, 4), 0xd02828, 0, 0, 0.3, 0); kg.add(new THREE.ConeGeometry(0.55, 0.5, 4), 0xf0c020, 0, 0, -0.4, 0, 0, Math.PI); for (let i = 0; i < 5; i++) kg.box(0.14, 0.02, 0.14, 0, -0.9 - i * 0.32, 0.05 * i, i % 2 ? 0x2f6fb8 : 0xf0c020);
    const kgeo = kg.geometry(); kgeo.deleteAttribute('aGlow');
    life.kite = new THREE.Mesh(kgeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); life.kite.name = 'southpark:kite'; life.kite.scale.setScalar(1.25);
    life.string = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3)), new THREE.LineBasicMaterial({ color: 0xe8e8e8 })); life.string.frustumCulled = false;
    scene.add(life.kite, life.string);
    for (const [x, z] of [KICK[0], KICK[1]]) { const j = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.34), new THREE.MeshLambertMaterial({ color: 0x2a3a6a })); j.position.set(x + (x < 1970 ? -2.5 : 2.5), 0.09, z + 2.2); scene.add(j); life.chars.push({ group: j, update() {} }); }   // jumpers for goalposts
  }
  const show = (on) => { if (!life.made || life.on === on) return; life.on = on; for (const c of life.chars) c.group.visible = on; life.ball.visible = on; life.kite.visible = on; life.string.visible = on; };
  /** call per frame; near = player within ~170 m of the pitch, allowed = by day and not a fireworks evening */
  out.updateLife = (dt, near, allowed) => {
    const want = near && allowed;
    if (!want) { show(false); return; }
    if (!life.made) makeLife();
    show(true);
    const t = game.time.now() / 1000, P = 2.6, k = t / P, n = Math.floor(k), f = k - n, dir = n % 2;
    const a = KICK[dir], b = KICK[1 - dir], fl = Math.min(1, f / 0.62), gy = W.groundHeight(a[0], a[1]);
    life.ball.position.set(a[0] + (b[0] - a[0]) * fl, gy + 0.11 + Math.sin(fl * Math.PI) * (0.4 + 1.4 * hash(n, 3)), a[1] + (b[1] - a[1]) * fl);
    for (let i = 0; i < 2; i++) { const c = life.chars[i], o = KICK[1 - i]; c.group.rotation.y = Math.atan2(o[0] - KICK[i][0], o[1] - KICK[i][1]) + Math.sin(t * 0.7 + i) * 0.15; c.update(dt, 0); }
    // the kite rides a slow figure of eight
    const kx = KITE[0] + 9 + Math.sin(t * 0.5) * 5, ky = 13 + Math.sin(t * 1.0) * 2.2, kz = KITE[1] - 7 + Math.cos(t * 0.5) * 2;
    life.kite.position.set(kx, ky, kz); life.kite.rotation.set(0.5, t * 0.2, Math.sin(t * 0.5) * 0.4);
    const fl3 = life.chars[2]; fl3.group.rotation.y = Math.atan2(kx - KITE[0], kz - KITE[1]); fl3.update(dt, 0);
    const sp = life.string.geometry.attributes.position; sp.setXYZ(0, KITE[0], 1.35, KITE[1]); sp.setXYZ(1, kx, ky - 0.5, kz); sp.needsUpdate = true;
  };
  out.life = life;
  return out;
}
