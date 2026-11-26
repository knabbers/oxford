// Supermarkets: shopfronts built in place on the real OSM buildings. Each frontage is drawn just proud of the city's
// facade (which keeps its upper storeys): fascia board with the brand lettering, pilasters and mullions, glazing showing
// a bright interior with posters, automatic sliding doors (one InstancedMesh for every store), cash machine in the wall,
// opening-hours plate, A-board, canopy / trolleys where sourced. Per store: 2 draw calls (+1 for the CLOSED sign).
import * as THREE from 'three';
import { Mesher } from './_shop_mesh.js';
import { Atlas, BRAND, drawFascia, drawPoster, drawWindow, fitText } from './_shop_tex.js';

const PI = Math.PI;
function pointInPoly(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Edge frame: A->B along the wall, n = outward normal (away from the building polygon). */
export function edgeFrame(a, b, poly) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
  let nx = dz, nz = -dx;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  if (poly && pointInPoly(mx + nx * 0.6, mz + nz * 0.6, poly)) { nx = -nx; nz = -nz; }
  const heading = Math.atan2(nx, nz);
  return { a, b, L, dx, dz, nx, nz, heading, P: (t, w = 0) => [a[0] + dx * t + nx * w, a[1] + dz * t + nz * w] };
}

let atlas = null;
const tiles = {};
function extAtlas() {
  if (atlas) return atlas;
  atlas = new Atlas(2048, 1024);
  tiles.blank = atlas.add('__blank', 8, 8, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 8); });
  for (const [k, brand, fmt] of [['tesco_metro', 'tesco', 'metro'], ['tesco_express', 'tesco', 'express'], ['sains_local', 'sainsburys', 'local'], ['sains_super', 'sainsburys', 'super']])
    tiles[k] = atlas.add(k, 640, 128, (g, w, h) => drawFascia(g, w, h, brand, fmt));
  tiles.winT = atlas.add('winT', 360, 240, (g, w, h) => drawWindow(g, w, h, 'tesco', 1));
  tiles.winT2 = atlas.add('winT2', 360, 240, (g, w, h) => drawWindow(g, w, h, 'tesco', 2));
  tiles.winS = atlas.add('winS', 360, 240, (g, w, h) => drawWindow(g, w, h, 'sainsburys', 3));
  tiles.winS2 = atlas.add('winS2', 360, 240, (g, w, h) => drawWindow(g, w, h, 'sainsburys', 4));
  tiles.doorview = atlas.add('doorview', 200, 240, (g, w, h) => { drawWindow(g, w, h, 'tesco', 7); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, w, h); });
  tiles.atm = atlas.add('atm', 128, 160, (g, w, h) => {
    g.fillStyle = '#5a5e62'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1c1e'; g.fillRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#3a8ad0'; g.fillRect(22, 22, w - 44, 50); g.fillStyle = '#fff'; g.font = 'bold 12px Arial'; g.textAlign = 'center'; g.fillText('Free cash', w / 2, 44); g.fillText('withdrawals', w / 2, 60);
    g.fillStyle = '#8a9198'; for (let i = 0; i < 12; i++) g.fillRect(36 + (i % 3) * 20, 84 + Math.floor(i / 3) * 11, 15, 8);
    g.fillStyle = '#111'; g.fillRect(30, 134, w - 60, 6); g.fillStyle = '#e8c020'; g.fillRect(w - 34, 82, 14, 20);
  });
  const hoursTile = (k, text, brand) => (tiles[k] = atlas.add(k, 256, 128, (g, w, h) => drawPoster(g, w, h, '#ffffff', [[brand === 'tesco' ? 'Opening hours' : 'Opening times', 20, brand === 'tesco' ? BRAND.tesco.blue : BRAND.sainsburys.orange], ...text.split(' · ').map((t) => [t, 17, '#222'])], '#999')));
  tiles.hoursText = hoursTile;
  tiles.mdT = atlas.add('mdT', 180, 260, (g, w, h) => drawPoster(g, w, h, BRAND.tesco.blue, [['Meal', 40, '#fff'], ['Deal', 40, '#fff'], ['£3', 74, '#fff'], ['sandwich · snack · drink', 13, '#cfe0f4']]));
  tiles.mdS = atlas.add('mdS', 180, 260, (g, w, h) => drawPoster(g, w, h, BRAND.sainsburys.orange, [['Meal', 40, '#fff'], ['deal', 40, '#fff'], ['£3', 74, '#fff'], ['main · snack · drink', 13, '#fff']]));
  tiles.closed = atlas.add('closed', 256, 160, (g, w, h) => drawPoster(g, w, h, '#ffffff', [['Sorry,', 26, '#333'], ["we're closed", 34, '#c00000']], '#c00000'));
  tiles.bigissue = atlas.add('bigissue', 128, 170, (g, w, h) => { g.fillStyle = '#d01818'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; fitText(g, 'THE BIG ISSUE', w * 0.9, 18); g.fillText('THE BIG ISSUE', w / 2, 24); g.fillStyle = '#f0e0c0'; g.fillRect(12, 34, w - 24, h - 48); g.fillStyle = '#333'; g.font = 'bold 12px Arial'; g.fillText('£2.50', w / 2, h - 4); });
  return atlas;
}

let mats = null;
function extMats(world) {
  if (mats) return mats;
  const A = extAtlas(), tex = A.texture();
  const fix = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
  const sign = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  if (world?.registerNight) world.registerNight(sign, 0.85, 0.05);
  const closed = new THREE.MeshBasicMaterial({ map: tex });
  const door = new THREE.MeshStandardMaterial({ color: 0xa8c8d4, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.5, depthWrite: false });
  return (mats = { fix, sign, closed, door, tex });
}

/** the glazing of a frontage: `solids` = the glazed stretches [t0, t1] between the door / cash machine, `panes` = each
 *  stretch cut into panes of about 2 m (pure: used to draw the front and to plan a walk-in shop's real windows) */
export function frontPanes(spec, E, main = true) {
  const t0 = spec.t0, t1 = Math.min(spec.t1, E.L), door = main ? spec.door : null, dw = spec.doorW || 1.8;
  const solids = [], cuts = [], panes = [];
  let s = t0 + 0.12;
  if (door !== null && door !== undefined) cuts.push([door - dw / 2 - 0.08, door + dw / 2 + 0.08, 'door']);
  if (main && spec.atm !== undefined) cuts.push([spec.atm - 0.5, spec.atm + 0.5, 'atm']);
  cuts.sort((p, q) => p[0] - q[0]);
  for (const c of cuts) { if (c[0] - s > 0.3) solids.push([s, c[0]]); s = c[1]; }
  if (t1 - 0.12 - s > 0.3) solids.push([s, t1 - 0.12]);
  for (const [a, b] of solids) { const n = Math.max(1, Math.round((b - a) / 2.0)), seg = (b - a) / n; for (let i = 0; i < n; i++) panes.push([a + i * seg, a + (i + 1) * seg]); }
  return { solids, cuts, panes, t0, t1, door, dw };
}

/**
 * Build one branch's exterior. `sl` (the shop is a walk-in room): { holes: [[t0, t1]…] } = the stretches of the main
 * frontage that are real windows — no painted window there, no painted view through the door, no sliding panels of
 * its own (out.sl is set; the room's real door and glass are drawn by the room). Returns { group, doorPos:[x,z], doorFacing, door:{...}, closedMesh, atm:[x,z]|null,
 * aboard:[x,z], bigIssue:[x,z,h]|null, update }.
 */
export function buildExterior(game, branch, poly, sl = null) {
  const world = game.world, M = extMats(world), A = extAtlas();
  const fix = new Mesher(), sign = new Mesher(), closed = new Mesher(), far = new Mesher();      // far: the painted panes of a walk-in shop's real windows, shown until the room is
  const tesco = branch.brand === 'tesco';
  const frameCol = tesco ? 0x4a5057 : 0x3a3a3c, fasciaCol = tesco ? 0xffffff : 0xf06c00;
  const fasciaTile = tesco ? (branch.fmt === 'metro' ? tiles.tesco_metro : tiles.tesco_express) : (branch.fmt === 'local' ? tiles.sains_local : tiles.sains_super);
  const hoursKey = 'hours_' + branch.id; if (!A.uv.has(hoursKey)) tiles.hoursText(hoursKey, branch.hoursText, branch.brand);
  const out = { group: new THREE.Group(), branch, atm: null, aboard: null, bigIssue: null };

  // quad on the wall plane: t along the edge, v up, w outward; faces outward
  const wallQuad = (E, m, t0, t1, v0, v1, w, uv) => {
    const flip = -E.dz * E.nx + E.dx * E.nz < 0, [x, z] = E.P(flip ? t1 : t0, w), L = (t1 - t0) * (flip ? -1 : 1);
    m.quad(x, v0, z, E.dx * L, 0, E.dz * L, 0, v1 - v0, 0, { uv });
  };
  const wallBox = (E, t0, t1, v0, v1, w0, w1, color) => { const [x, z] = E.P((t0 + t1) / 2, (w0 + w1) / 2); fix.box(x, v0, z, t1 - t0, v1 - v0, w1 - w0, E.heading, { color }); };

  const frontage = (spec, main) => {
    const E = edgeFrame(spec.a, spec.b, poly), t0 = spec.t0, t1 = Math.min(spec.t1, E.L), W = t1 - t0, W0 = 0.06;
    // ground-floor surround
    wallBox(E, t0, t1, 0, 0.42, W0, W0 + 0.08, 0x2a2c30);                          // stallriser
    wallBox(E, t0, t1, 2.85, 3.05, W0, W0 + 0.1, frameCol);                         // transom
    // fascia board with the lettering centred
    wallBox(E, t0 - 0.05, t1 + 0.05, 3.05, 3.85, W0, W0 + 0.2, fasciaCol);
    wallBox(E, t0 - 0.05, t1 + 0.05, 3.85, 3.92, W0, W0 + 0.24, frameCol);
    const fw = Math.min(W - 0.2, 3.6), fc = spec.door !== undefined && main ? Math.max(t0 + fw / 2 + 0.1, Math.min(t1 - fw / 2 - 0.1, spec.door)) : (t0 + t1) / 2;
    wallQuad(E, sign, fc - fw / 2, fc + fw / 2, 3.1, 3.1 + fw / 5, W0 + 0.205, fasciaTile);
    // openings: door, ATM pier, windows
    const { solids, cuts, door, dw } = frontPanes(spec, E, main);
    const holed = (u) => !!(sl && main && sl.holes.some(([ha, hb]) => u > ha && u < hb));
    // end pilasters
    wallBox(E, t0, t0 + 0.14, 0, 2.85, W0, W0 + 0.12, frameCol); wallBox(E, t1 - 0.14, t1, 0, 2.85, W0, W0 + 0.12, frameCol);
    let wi = 0;
    for (const [a, b] of solids) {
      const n = Math.max(1, Math.round((b - a) / 2.0)), seg = (b - a) / n;
      for (let i = 0; i < n; i++) {
        const u0 = a + i * seg, u1 = u0 + seg;
        wallQuad(E, holed((u0 + u1) / 2) ? far : sign, u0 + 0.03, u1 - 0.03, 0.42, 2.85, W0 + 0.02, tesco ? (wi++ % 2 ? tiles.winT2 : tiles.winT) : (wi++ % 2 ? tiles.winS2 : tiles.winS));
        if (!(holed(u1 - 0.2) && holed(u1 + 0.2))) wallBox(E, u1 - 0.04, u1 + 0.04, 0.42, 2.85, W0, W0 + 0.08, frameCol);      // (inside a real window the glazing bars are the room's)
      }
      wallBox(E, a - 0.04, a + 0.04, 0.42, 2.85, W0, W0 + 0.08, frameCol);
    }
    for (const c of cuts) {
      if (c[2] === 'door') {
        const d0 = door - dw / 2, d1 = door + dw / 2;
        wallQuad(E, sl ? far : sign, d0, d1, 0, 2.5, W0 + 0.01, tiles.doorview);
        wallBox(E, d0 - 0.08, d0, 0, 2.85, W0, W0 + 0.12, frameCol); wallBox(E, d1, d1 + 0.08, 0, 2.85, W0, W0 + 0.12, frameCol);
        wallBox(E, d0, d1, 2.5, 2.85, W0, W0 + 0.12, frameCol);
        wallQuad(E, sign, d1 + 0.12, d1 + 0.62, 1.25, 1.5, W0 + 0.03, A.uv.get(hoursKey));   // hours plate on the glass
        wallQuad(E, closed, d0 + dw * 0.2, d1 - dw * 0.2, 1.2, 1.2 + (dw * 0.6) * 0.62, W0 + 0.15, tiles.closed);
        { const [mx, mz] = E.P(door, 0.55); let my = 0.13; try { if (world.groundHeight) { const h = world.groundHeight(mx, mz); if (Number.isFinite(h)) my = h + (spec.forecourt ? 0.05 : 0.02); } } catch { /* the old height */ }
          fix.box(mx, my, mz, dw + 0.4, 0.012, 0.9, E.heading, { color: 0x2a2c30 }); }   // mat (on the ground as drawn there)
        out.door = { t: door, w: dw, E, open: 0, x: E.P(door, 0)[0], z: E.P(door, 0)[1] };
        out.doorPos = E.P(door, 1.0); out.doorFacing = E.heading;
        if (spec.canopy) { wallBox(E, d0 - 0.6, d1 + 0.6, 2.95, 3.05, W0, W0 + 1.0, frameCol); }
        if (spec.trolleys && d1 + 1.0 + 6 * 0.28 + 0.3 < t1) {   // a short row of nested trolleys beside the door (only where the frontage has the room: not through the next shop's front)
          for (let k = 0; k < 6; k++) {
            const [tx, tz] = E.P(d1 + 1.0 + k * 0.28, 1.0);
            fix.box(tx, 0.3, tz, 0.56, 0.5, 0.8, E.heading, { color: 0xa8b0b8 });
            const [hx, hz] = E.P(d1 + 1.0 + k * 0.28, 1.42); fix.box(hx, 0.95, hz, 0.56, 0.04, 0.04, E.heading, { color: 0xf06c00 });
          }
          const [cx, cz] = E.P(d1 + 1.0 + 0.7, 1.0); game.worldCollider.addBox(cx, cz, 2.1, 0.9, E.heading);
        }
      } else if (c[2] === 'atm') {
        const m = spec.atm;
        wallBox(E, m - 0.5, m + 0.5, 0, 2.85, W0, W0 + 0.1, tesco ? 0x8a8f94 : 0x7a7a7c);
        wallQuad(E, sign, m - 0.32, m + 0.32, 0.95, 1.75, W0 + 0.105, tiles.atm);
        wallBox(E, m - 0.36, m + 0.36, 0.9, 0.95, W0, W0 + 0.22, 0x333333);   // ledge
        out.atm = E.P(m, 0.9);
      }
    }
    return E;
  };
  const E = frontage(branch.front, true);
  if (branch.side) frontage(branch.side, false);

  // A-board on the pavement (meal deal)
  if (branch.fmt !== 'super') {
    const t = branch.front.door + (branch.front.doorW || 1.8) / 2 + 1.0, [bx, bz] = E.P(t, 1.3);
    const tile = tesco ? tiles.mdT : tiles.mdS, hgt = 0.95, wid = 0.6, lean = 0.22;
    // two leaning panels: hinged at the top, facing up and down the street
    for (const sgn of [-1, 1]) {
      const footX = bx + E.dx * sgn * lean, footZ = bz + E.dz * sgn * lean;
      // corner at foot, spans across the pavement (normal dir) and up to the hinge
      const cx = footX - E.nx * wid / 2, cz = footZ - E.nz * wid / 2;
      const ux = E.nx * wid, uz = E.nz * wid;
      const vx = -E.dx * sgn * lean, vy = hgt, vz = -E.dz * sgn * lean;
      // outward facing: normal = u × v should point along +sgn*d
      const facing = -uz * vy * E.dx + ux * vy * E.dz;
      if (facing * sgn > 0) sign.quad(cx, 0, cz, ux, 0, uz, vx, vy, vz, { uv: tile });
      else sign.quad(cx + ux, 0, cz + uz, -ux, 0, -uz, vx, vy, vz, { uv: tile });
    }
    fix.box(bx, hgt - 0.06, bz, 0.06, 0.06, wid + 0.04, E.heading, { color: 0x222222 });
    game.worldCollider.addBox(bx, bz, 0.5, 0.65, E.heading);
    out.aboard = [bx, bz];
  }
  if (branch.id === 'tesco_magdalen') { const [x, z] = E.P(branch.front.door + branch.front.doorW / 2 + 2.2, 1.5); out.bigIssue = [x, z, E.heading + PI * 0.1]; }

  const fm = fix.mesh(M.fix), sm = sign.mesh(M.sign), cm = closed.mesh(M.closed);
  fm.castShadow = false; fm.receiveShadow = true; sm.receiveShadow = true;
  out.group.add(fm, sm, cm); cm.visible = false; out.closedMesh = cm;
  // (walk-in: from further off than the room is drawn — or before it is ready — the real windows and doorway show their painted
  //  selves, not the bare wall of the building behind the frontage; supermarkets.js hides this once the room or its picture is there)
  if (sl && !far.empty) { const pm = far.mesh(M.sign); pm.name = 'shop:far-panes'; pm.receiveShadow = true; out.group.add(pm); out.farPanes = pm; }
  // a paved forecourt from the frontage out to the pavement, where the map has a verge between them (GUESS: its depth)
  if (branch.front.forecourt && world.flat && world.mats && world.mats.paving) {
    try {
      const f = branch.front, d = f.forecourt, t0 = f.t0 - 0.4, t1 = Math.min(f.t1, E.L) + 0.4, [gx, gz] = E.P((t0 + t1) / 2, d / 2);
      const y = (world.groundHeight ? world.groundHeight(gx, gz) : 0) + 0.035;
      const pm = new THREE.Mesh(world.flat([E.P(t0, 0.02), E.P(t1, 0.02), E.P(t1, d), E.P(t0, d)], y), world.mats.paving);
      pm.name = 'shop:forecourt'; pm.receiveShadow = true; pm.castShadow = false; out.group.add(pm);
    } catch (e) { console.warn('[supermarkets] forecourt', e); }
  }
  out.sl = !!sl;
  out.group.name = 'shop:' + branch.id;
  // (terrain: a shop front is built on one of the city's own buildings: where that one stands level on a slope the
  //  front takes its level - the draping pass does it for a place's static groups, this group is not marked static)
  if (game.world && game.world.terrainStandObject) game.world.terrainStandObject(out.group);
  game.worldScene.add(out.group);
  out.tris = (fix.tris + sign.tris + closed.tris) | 0;
  return out;
}

/** One InstancedMesh holding 2 sliding panels for every exterior doorway. */
export function exteriorDoors(game, stores) {
  const M = extMats(game.world);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.door, stores.length * 2);
  mesh.frustumCulled = false; game.worldScene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
  const set = (i, st) => {
    const d = st.door, E = d.E, pw = d.w / 2; q.setFromAxisAngle(up, E.heading);
    for (const sg of [-1, 1]) {
      const t = d.t + sg * (pw / 2 + d.open * pw * 0.92);
      const [x, z] = E.P(t, 0.1 + (sg > 0 ? 0.03 : 0));
      p.set(x, 1.25, z); s.set(pw, 2.5, 0.03); m4.compose(p, q, s); mesh.setMatrixAt(i * 2 + (sg > 0 ? 1 : 0), m4);
    }
  };
  stores.forEach((st, i) => set(i, st));
  mesh.instanceMatrix.needsUpdate = true;
  return {
    mesh,
    update(dt, px, pz, openFn) {
      let dirty = false;
      stores.forEach((st, i) => {
        const d = st.door; if (!d) return;
        const dist = Math.hypot(px - d.x, pz - d.z);
        if (dist > 40 && d.open === 0) return;
        const want = dist < 3.2 && openFn(st) ? 1 : 0;
        const o = d.open + (want - d.open) * Math.min(1, dt * 5);
        if (Math.abs(o - d.open) > 1e-4 || (want === 0 && d.open !== 0)) { d.open = Math.abs(o) < 1e-3 ? 0 : o; set(i, st); dirty = true; }
      });
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
