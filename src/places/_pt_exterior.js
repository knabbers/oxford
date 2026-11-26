// Purple Turtle — the Frewin Court frontage, built in place in the world scene.
// The map building w293563591 (the small Union block on the north side of the alley, with the covered passage
// w39667567 through to the Union yard) is skipped and rebuilt with: the club's doorway in a recessed niche (fascia,
// round turtle sign, double doors that swing out, the stair down painted beyond), the open archway of the passage,
// wall lanterns, the rope-and-post queue line along the Clarendon Centre wall opposite, posters, a smoking corner and a
// generic kebab van on Cornmarket by the end of the alley. ≈ 9 draw calls.
//
// Alley frame: u along the north wall from its west corner A (75.5, 232.5) towards Cornmarket, v = depth INTO the
// building (v < 0 is the alley; the Clarendon wall opposite is at v ≈ −2.27).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GB } from './_pt_geo.js';
import { ptAtlas, uvRect, ptGlow } from './_pt_tex.js';
import { ALLEY } from './_pt_routes.js';
import { SEAMLESS } from '../core/interiors.js';

export const BLD_ID = 'w293563591';
const { A, EX, EY } = ALLEY;
export { ALLEY };

export function buildExterior(game) {
  const world = game.world, P = ALLEY.P, out = { meshes: [] };
  const add = (m) => { if (m) { world.addStatic(m); out.meshes.push(m); } return m; };
  const rect = (u0, u1, v0, v1) => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
  const D = ALLEY.depth, [n0, n1] = ALLEY.niche, nd = ALLEY.nicheDepth, nh = ALLEY.nicheH, [p0, p1] = ALLEY.passage, ph = ALLEY.passageH;
  // ------------------------------------------------------------------ the building: brick walls (blank ground floor, sash windows above)
  const lowM = world.facadeMaterial({ material: 'brick', windows: 'none', tint: 0xc8a8a0 });
  const upM = world.facadeMaterial({ material: 'brick', windows: 'sash', tint: 0xc8a8a0 });
  const E = (poly, y0, y1, m) => world.extrude(poly, y0, y1, { top: false, uScale: m.userData.bay, vScale: m.userData.storey, vOrigin: 0 });
  const blocks = [
    { poly: rect(-0.17, n0, 0, D), y0: 0 }, { poly: rect(n0, n1, nd, D), y0: 0 }, { poly: rect(n0, n1, 0, nd), y0: nh },
    { poly: rect(n1, p0, 0, D), y0: 0 }, { poly: rect(p0, p1, 0, D), y0: ph }, { poly: rect(p1, 6.5, 0, D), y0: 0 },
  ];
  const lows = [], ups = [];
  for (const b of blocks) { if (b.y0 < 3.0) lows.push(E(b.poly, b.y0, 3.0, lowM)); ups.push(E(b.poly, Math.max(3.0, b.y0), 7.6, upM)); }
  const low = add(new THREE.Mesh(mergeGeometries(lows), lowM)), up = add(new THREE.Mesh(mergeGeometries(ups), upM));
  low.receiveShadow = up.receiveShadow = true; low.castShadow = up.castShadow = true;
  const roof = add(new THREE.Mesh(world.flat(rect(-0.17, 6.5, 0, D), 7.6), world.mats.lead)); roof.castShadow = true;
  // soffits: niche ceiling and passage ceiling (brick, facing down)
  add(new THREE.Mesh(mergeGeometries([world.flat(rect(n0, n1, 0, nd), nh, [], { down: true }), world.flat(rect(p0, p1, 0, D), ph, [], { down: true })]), world.mats.brick));
  // colliders: the solid blocks (the passage stays open, as in OSM)
  const col = game.worldCollider;
  for (const b of [blocks[0], blocks[1], blocks[3], blocks[5]]) col.addPolygon(b.poly, { tag: 'building' });

  // ------------------------------------------------------------------ signs, posters, painted stair (one atlas material, lit at night)
  const atlas = ptAtlas();
  const signM = new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 });
  out.signMat = signM;
  const S = new GB();
  const wallQ = (u0, u1, v, y0, y1, reg, inset = 2) => { const a = P(u0, v), b = P(u1, v); S.wall(a[0], a[1], b[0], b[1], y0, y1, [-EY[0], 0, -EY[1]], uvRect(reg, inset)); };
  wallQ(0.5, 3.1, -0.03, 2.52, 3.05, 'fascia');
  wallQ(0.1, 0.9, -0.03, 1.15, 1.68, 'price');
  // (walk-in: the stair behind the doors is the real one — no painted picture of it, whose dark edge showed as a black
  // band round the real doorway; the niche's back is its brick)
  if (!SEAMLESS) wallQ(n0 + 0.05, n1 - 0.05, nd - 0.02, 0, 2.25, 'stairs');
  [6.9, 7.7, 10.4, 11.2].forEach((u, i) => wallQ(u, u + 0.6, -0.03, 1.15, 2.2, 'poster' + i));
  wallQ(-2.8, -1.6, -0.03, 1.85, 2.15, 'smoking');
  // round projecting sign (both faces) on a bracket
  { const c = P(0.35, -0.55), y = 3.45, r = 0.42, a = [c[0] - EY[0] * 0.0, c[1]];
    const s0 = [c[0] - EY[0] * r, c[1] - EY[1] * r], s1 = [c[0] + EY[0] * r, c[1] + EY[1] * r];
    const rr = uvRect('turtle', 3);
    S.wall(s0[0], s0[1], s1[0], s1[1], y - r, y + r, [EX[0], 0, EX[1]], rr);
    S.wall(s1[0], s1[1], s0[0], s0[1], y - r, y + r, [-EX[0], 0, -EX[1]], rr); void a; }
  add(S.mesh(signM));
  // door closed sign (shown by day) — a separate small mesh on the doors
  // ------------------------------------------------------------------ metalwork, ropes, van, frames: one vertex-coloured material
  const colM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.1 });
  const C = new GB(true), Y0 = 0;
  // door frame
  C.color(0x2a0a3a);
  const fr = (u0, u1, v0, v1, y0, y1) => { const q = rect(u0, u1, v0, v1); C.at(0, 0, 0, 0); const cx = (q[0][0] + q[2][0]) / 2, cz = (q[0][1] + q[2][1]) / 2; C.at(cx, 0, cz, ALLEY.hU - Math.PI / 2); C.box(0, y0, 0, Math.abs(u1 - u0), y1 - y0, Math.abs(v1 - v0)); C.reset(); };
  fr(n0 + 0.0, n0 + 0.1, nd - 0.12, nd, 0, 2.3); fr(n1 - 0.1, n1, nd - 0.12, nd, 0, 2.3); fr(n0, n1, nd - 0.12, nd, 2.22, 2.32);
  // handrails down the sides of the niche (as if round the stairhead)
  C.color(0x161616);
  for (const u of [n0 + 0.1, n1 - 0.1]) { const a = P(u, 0.08), b = P(u, nd - 0.15); C.rod([a[0], 0.95, a[1]], [b[0], 0.95, b[1]], 0.022); C.rod([a[0], 0, a[1]], [a[0], 0.95, a[1]], 0.02); C.rod([b[0], 0, b[1]], [b[0], 0.95, b[1]], 0.02); }
  // sign bracket
  { const a = P(0.35, 0), b = P(0.35, -0.6); C.rod([a[0], 3.92, a[1]], [b[0], 3.92, b[1]], 0.02); C.rod([a[0], 3.6, a[1]], [b[0], 3.92, b[1]], 0.015); }
  // rope-and-post queue line
  const Q = ALLEY.queue, posts = [];
  // (the rope starts clear of the doorway — u 1.0..2.6 — so the club's door can be walked up to head-on)
  for (let u = 3.0; u <= 12.3; u += 2.14) posts.push(u);
  posts.forEach((u, i) => {
    const p = P(u, Q.rope); C.color(0xc8a040); C.cyl(p[0], 0, p[1], 0.04, 0.95, 8); C.cyl(p[0], 0, p[1], 0.16, 0.04, 10); C.cyl(p[0], 0.95, p[1], 0.06, 0.06, 8);
    col.addCircle(p[0], p[1], 0.12, { tag: 'post' });
    if (i < posts.length - 1) {
      const q = P(posts[i + 1], Q.rope); C.color(0x8a0a2a);
      const N = 6; let prev = [p[0], 0.9, p[1]];
      for (let k = 1; k <= N; k++) { const t = k / N, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t, y = 0.9 - Math.sin(t * Math.PI) * 0.16; C.rod(prev, [x, y, z], 0.025); prev = [x, y, z]; }
      col.addSegment(p[0], p[1], q[0], q[1], { tag: 'rope', low: true });
    }
  });
  // smoking corner: a wall ashtray bin
  { const p = P(-1.0, -0.22); C.color(0x2a2a2a); C.cyl(p[0], 0, p[1], 0.17, 0.95, 10); C.color(0x8a8a8a); C.cyl(p[0], 0.95, p[1], 0.18, 0.05, 10); col.addCircle(p[0], p[1], 0.2, { tag: 'bin' }); }
  // ------------------------------------------------------------------ the kebab van on Cornmarket (generic)
  const V = ALLEY.van;
  C.at(V.x, 0, V.z, V.h);
  C.color(0xf0f0ec);
  const VW = 2.3, VL = 5.4;
  C.box(0, 0.45, -0.4, VW, 0.65, 4.4, {});                        // lower body
  // upper body with the serving hatch cut into the +x side
  C.box(0, 1.1, -0.4, VW, 1.25, 4.4, { e: true });
  C.box(VW / 2 - 0.03, 1.1, -2.0, 0.06, 1.25, 1.2);       // +x wall pieces around the hatch
  C.box(VW / 2 - 0.03, 1.1, -0.4 + 1.85, 0.06, 1.25, 0.7);
  C.box(VW / 2 - 0.03, 1.1, -0.15, 0.06, 0.12, 2.5);
  C.box(VW / 2 - 0.03, 1.95, -0.15, 0.06, 0.4, 2.5);
  C.box(0, 0.45, 2.15, VW, 1.25, 0.9); C.color(0x3a4a5a); C.box(0, 1.7, 2.45, VW - 0.2, 0.55, 0.32, {});   // cab + windscreen
  C.color(0xc81818); C.box(0, 0.42, -0.4, VW + 0.02, 0.12, 4.42);
  C.color(0xd8d8d8); C.box(VW / 2 + 0.25, 2.38, -0.15, 0.6, 0.05, 2.6);   // awning
  C.color(0xb0b0b0); C.box(VW / 2 + 0.12, 1.12, -0.15, 0.28, 0.05, 2.4);   // counter ledge
  C.color(0x111111); for (const [x, z] of [[-1.05, 1.9], [1.05, 1.9], [-1.05, -1.6], [1.05, -1.6]]) C.box(x, 0, z, 0.25, 0.7, 0.7);
  C.reset();
  add(C.mesh(colM));
  // van sign + lit hatch backdrop (atlas)
  const VS = new GB();
  { const c = Math.cos(V.h), s = Math.sin(V.h), L = (x, z) => [V.x + x * c + z * s, V.z - x * s + z * c];
    const a = L(VW / 2 + 0.01, 1.05), b = L(VW / 2 + 0.01, -1.35), nx = [c, 0, -s];
    VS.wall(a[0], a[1], b[0], b[1], 2.0, 2.35, nx, uvRect('vanSign', 2));
    const a2 = L(-0.4, 1.0), b2 = L(-0.4, -1.3);
    VS.wall(a2[0], a2[1], b2[0], b2[1], 1.17, 1.95, nx, uvRect('hatch', 2));
    const a3 = L(-VW / 2 - 0.01, -1.35), b3 = L(-VW / 2 - 0.01, 1.05);
    VS.wall(a3[0], a3[1], b3[0], b3[1], 1.5, 1.85, [-c, 0, s], uvRect('vanSign', 2));
    out.vanHatch = L(VW / 2 + 0.9, -0.15); out.vanLocal = L;
    const lg = L(VW / 2 + 0.35, -0.15); world.addLampGlow(lg[0], 2.3, lg[1]); }
  add(VS.mesh(signM));
  col.addBox(V.x, V.z, VW, VL - 0.2, V.h, { tag: 'van' });
  try { world.clearArea([out.vanLocal(-1.5, 3.2), out.vanLocal(1.5, 3.2), out.vanLocal(1.5, -2.8), out.vanLocal(-1.5, -2.8)], { trees: false, lamps: false, furniture: true }); } catch { /* optional */ }

  // ------------------------------------------------------------------ the double doors (swing out into the niche)
  const doorM = new THREE.MeshStandardMaterial({ color: 0x3a1050, roughness: 0.55 });
  const dg = new THREE.BoxGeometry(0.69, 2.2, 0.05).translate(0.345, 1.1, 0);
  out.doors = [];
  for (const side of [0, 1]) {
    const hinge = P(side ? n1 - 0.1 : n0 + 0.1, nd - 0.08), g = new THREE.Group();
    g.position.set(hinge[0], 0, hinge[1]);
    const leaf = new THREE.Mesh(dg, doorM); if (side) leaf.scale.x = -1; leaf.castShadow = true;
    g.add(leaf); g.userData.side = side;
    // a little round window in each leaf
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), new THREE.MeshBasicMaterial({ color: 0x8a40c0 })); win.position.set(side ? -0.35 : 0.35, 1.55, 0.03); g.add(win);
    game.worldScene.add(g); out.doors.push(g);
  }
  // fix door orientation: leaves lie along +u when closed
  for (const g of out.doors) { g.rotation.y = Math.atan2(EX[0], EX[1]) - Math.PI / 2; g.userData.closedY = g.rotation.y; }
  out.closedSign = new THREE.Mesh(new GB().wall(0, 0, 0.6, 0, 0, 0.3, [0, 0, 1], uvRect('closed', 2)).geo(), signM);
  out.closedSign.position.set(0.05, 1.2, 0.035); out.doors[0].add(out.closedSign);
  // door collider (when shut the niche is closed; the bouncers stand in front anyway)
  { const a = P(n0, nd - 0.05), b = P(n1, nd - 0.05); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'door' }); }

  // ------------------------------------------------------------------ light: lanterns, a purple spill on the paving, cigarette glows
  { const l1 = P(3.05, -0.22); world.addLampGlow(l1[0], 3.4, l1[1]); const l2 = P(ALLEY.lamp2[0], -0.22); world.addLampGlow(l2[0], 3.0, l2[1]); }
  const spillM = new THREE.MeshBasicMaterial({ map: ptGlow(), color: 0xb040ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -20 });
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4).rotateX(-Math.PI / 2), spillM);
  const sp = P((n0 + n1) / 2, -0.55); spill.position.set(sp[0], 0.18, sp[1]); spill.rotation.y = ALLEY.hU - Math.PI / 2; spill.renderOrder = 2;
  game.worldScene.add(spill); out.spill = spill;
  const cigG = new THREE.BufferGeometry(); cigG.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 4), 3));
  out.cigs = new THREE.Points(cigG, new THREE.PointsMaterial({ color: 0xff7020, size: 0.05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  out.cigs.frustumCulled = false; game.worldScene.add(out.cigs);
  return out;
}

/** per-frame exterior state: open 0..1 (doors), night 0..1, clubOpen bool */
export function tickExterior(ext, dt, { doorOpen, night, clubOpen, t }) {
  for (const g of ext.doors) {
    const target = g.userData.closedY + (g.userData.side ? -1 : 1) * -1.45 * doorOpen;
    g.rotation.y += (target - g.rotation.y) * Math.min(1, dt * 6);
  }
  ext.closedSign.visible = !clubOpen;
  ext.signMat.emissiveIntensity = night * (clubOpen ? 0.95 : 0.12) + (clubOpen ? 0.05 : 0);
  ext.spill.material.opacity = clubOpen ? night * (0.25 + 0.55 * doorOpen) * (0.85 + 0.15 * Math.sin(t * 7)) : 0;
}
