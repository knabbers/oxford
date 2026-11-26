// University Parks dressing (owned by places/university_parks.js): T. G. Jackson's 1881 cricket pavilion (rebuilt in
// place of OSM w4068520), a cricket square, High Bridge ("Rainbow Bridge") drawn as a concrete arch with the walkable
// deck kept at ground level, opening-hours boards at the gates, red dog-waste bins, lily pads and ducks on Lazenbee's
// Pond. Sources: docs/research/venues.md §9; pavilion: Historic England list entry (red brick, tile-hung gable ends,
// 2 storeys, 5-bay verandah with French windows, front gabled in 3 bays with surface timbering and 2-light mullion-and-
// transom windows, red tile roof with balustraded cupola) + Wikipedia (clock in the central gable).
import { NORTH } from './_north_kit.js';
import * as THREE from 'three';
import { MBatch, mbox, canvasTex } from './_music_batch.js';

export const PAVILION_ID = 'w4068520';
export const BRIDGE_ROAD = 'w30093345', BRIDGE_AREA = 'w569994816';
// pavilion frame: a along the front (from the west corner), f out of the front (NNW, towards the field)
const P0 = [405.0, -715.1], PA = [0.855, -0.518], PF = [-0.518, -0.855];
const pw = (a, f) => [P0[0] + a * PA[0] + f * PF[0], P0[1] + a * PA[1] + f * PF[1]];
const B1 = [653.7, -881.5], B2 = [679.4, -898.4];
/** High Bridge as a real hump (north pass): rise of the deck's crown over the banks, how far the ramps run past the mapped ends (m) */
export const RAINBOW = { rise: 3.4, ext: 3.5 };
export const GATES = [
  { p: [173.9, -544.9], name: 'Keble Gate' }, { p: [80.8, -631.9], name: 'Parks Road' }, { p: [17.0, -764.8], name: 'North Gate' },
  { p: [649.7, -489.4], name: 'South Parks Road' }, { p: [679.4, -898.4], name: 'High Bridge' },
];
export const CRICKET = { c: [379.6, -786.3], u: [0.447, 0.894] };   // square centre, strip axis (towards the pavilion)

function sign(lines, w, h, bg, fg) {
  return canvasTex(512, Math.round((512 * h) / w), (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch); g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(8, 8, cw - 16, ch - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let y = 0; const tot = lines.reduce((s, l) => s + l[1] * 1.35, 0); y = (ch - tot) / 2;
    for (const [t, size, style] of lines) { g.font = `${style || 'bold'} ${size}px Georgia, "Times New Roman", serif`; y += size * 0.675; g.fillText(t, cw / 2, y); y += size * 0.675; }
  });
}

export function buildParks(game) {
  const W = game.world, B = new MBatch(), col = game.worldCollider;
  const timber = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2416';
    for (const x of [0, 64, 128, 192, 248]) g.fillRect(x, 0, 8, h);
    g.fillRect(0, 120, w, 8); g.fillRect(0, 248, w, 8);
    g.save(); g.translate(0, 0); g.lineWidth = 7; g.strokeStyle = '#3a2416'; for (const x of [0, 128]) { g.beginPath(); g.moveTo(x + 8, 128); g.lineTo(x + 64, 248); g.moveTo(x + 120, 128); g.lineTo(x + 64, 248); g.stroke(); } g.restore();
    // 2-light mullion-and-transom window in the middle
    g.fillStyle = '#e8e2d6'; g.fillRect(84, 20, 88, 96); g.fillStyle = '#1e2a34'; g.fillRect(90, 26, 36, 36); g.fillRect(130, 26, 36, 36); g.fillRect(90, 66, 36, 44); g.fillRect(130, 66, 36, 44);
  });
  const clockTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f6f2e6'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 5; g.stroke(); g.fillStyle = '#111'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 5, 4, 10); } });
  const pitchTex = canvasTex(64, 512, (g, w, h) => {
    g.fillStyle = '#b8b07a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(90,110,50,${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
    g.fillStyle = '#fff'; const L = 20.12, s = h / (L + 2.5), y0 = 1.25 * s;
    for (const e of [0, L]) { const yb = y0 + e * s, dir = e === 0 ? 1 : -1; g.fillRect(4, yb - 1, w - 8, 2); g.fillRect(0, yb + dir * 1.22 * s - 1, w, 2); for (const x of [6, w - 8]) g.fillRect(x, Math.min(yb, yb + dir * 1.22 * s), 2, 1.22 * s + 1); }
  });
  const mats = {
    tile: W.mats.tile, white: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 }), timber: new THREE.MeshStandardMaterial({ map: timber, roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1c2630, roughness: 0.15, metalness: 0.3 }), deck: W.mats.wood, lead: new THREE.MeshStandardMaterial({ color: 0x59646a, roughness: 0.5, metalness: 0.4 }),
    clock: new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.5 }), black: W.mats.blackPaint, concrete: new THREE.MeshStandardMaterial({ color: 0xc9c5ba, roughness: 0.9, side: THREE.DoubleSide }),
    rail: new THREE.MeshStandardMaterial({ color: 0x2c3a2e, roughness: 0.5, metalness: 0.3 }), bin: new THREE.MeshStandardMaterial({ color: 0xb0161c, roughness: 0.45 }),
    post: new THREE.MeshStandardMaterial({ color: 0x23402c, roughness: 0.6 }), pitch: W.layerMaterial(new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 1 }), 'marking'),
    square: W.layerMaterial(new THREE.MeshStandardMaterial({ color: 0x5d8a3a, roughness: 1 }), 'path'), stump: new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: 0.5 }),
    signs: null,
    _boardOut: (sign([['UNIVERSITY PARKS', 46], ['Open daily from 7.45 am', 30, 'normal'], ['Gates close at dusk', 30, 'normal'], ['No cycling · No barbecues', 26, 'normal'], ['No swimming', 26, 'normal']], 1.0, 1.2, '#1e3a28', '#f2ecd8')),
    _boardIn: (sign([['DOGS', 54], ['must be kept', 30, 'normal'], ['under control', 30, 'normal'], ['Please use the', 26, 'italic'], ['dog waste bins', 26, 'italic']], 1.0, 1.2, '#f2ecd8', '#1e3a28')),
    _bin: (sign([['DOG', 70], ['WASTE', 70]], 0.3, 0.3, '#b0161c', '#ffffff')),
  };

  // the three signs share one atlas (one draw call): [board out | board in | bin label] across 1536 x 614
  {
    const imgs = [mats._boardOut.image, mats._boardIn.image, mats._bin.image];
    mats.signs = new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTex(1536, 614, (g) => { g.fillStyle = '#777'; g.fillRect(0, 0, 1536, 614); imgs.forEach((im, i) => g.drawImage(im, i * 512, 0, 512, i < 2 ? 614 : 512)); }) });
    for (const k of ['_boardOut', '_boardIn', '_bin']) { mats[k].dispose(); delete mats[k]; }
  }
  const atlasPlane = (w, h, i) => { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, v1 = i < 2 ? 1 : 1 - (614 - 512) / 614; for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + uv.getX(k)) / 3, uv.getY(k) * (i < 2 ? 1 : 512 / 614) + (i < 2 ? 0 : 1 - 512 / 614)); void v1; return g; };
  // ------------------------------------------------------------------------------- pavilion
  const pv = { clock: null };
  {
    W.makeBuilding({ poly: [pw(0, -10), pw(23.2, -10), pw(23.2, 0), pw(0, 0)], h: 7.0, roof: 'gabled', roofH: 3.4, style: { wall: 'brick', roof: 'tile', color: '#c47a62' }, id: 'parks-pavilion' });
    W.makeBuilding({ poly: [pw(15.5, -13.45), pw(23.2, -13.45), pw(23.2, -10), pw(15.5, -10)], h: 3.8, roof: 'gabled', roofH: 1.6, style: { wall: 'brick', roof: 'tile', color: '#c47a62' }, id: 'parks-pavilion-wing' });
    const map = game.map.buildings.find((b) => b.id === PAVILION_ID);
    col.addPolygon(map ? map.poly : [pw(0, -10), pw(23.2, -10), pw(23.2, 0), pw(0, 0)], { tag: 'building' });
    // local frame group: x = −a (centred), z = f (front at z = 0 → +z towards the field)
    const L = new MBatch(), cx = 11.6;
    // verandah: deck, 6 posts (5 bays), lean-to roof, French windows
    L.span('deck', -8.2, 8.2, 0, 0.25, 0, 2.6);
    for (let i = 0; i <= 5; i++) { const x = -8 + i * 3.2; L.span('white', x - 0.09, x + 0.09, 0.25, 3.05, 2.35, 2.53); }
    L.span('white', -8.2, 8.2, 2.95, 3.12, 2.3, 2.58);
    L.add('tile', mbox(16.8, 0.08, 3.0), 0, 3.3, 1.35, [0.22, 0, 0]);
    for (let i = 0; i < 5; i++) { const x = -6.4 + i * 3.2; L.span('glass', x - 1.0, x + 1.0, 0.3, 2.55, 0.02, 0.05); L.span('white', x - 1.08, x + 1.08, 2.55, 2.65, 0.02, 0.07); L.span('white', x - 0.04, x + 0.04, 0.3, 2.55, 0.05, 0.08); for (const sx of [-1.04, 1.04]) L.span('white', x + sx - 0.04, x + sx + 0.04, 0.3, 2.6, 0.03, 0.08); }
    // three timbered front gables with their own roofs; clock in the middle one
    for (const gx of [-6.2, 0, 6.2]) {
      const hw = 2.7, y0 = 7.0, y1 = 9.9;
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([gx - hw, y0, 0.08, gx + hw, y0, 0.08, gx, y1, 0.08], 3));
      tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); tri.computeVertexNormals();
      L.add('timber', tri);
      L.add('timber', new THREE.PlaneGeometry(hw * 2, y0 - 5.2), gx, (y0 + 5.2) / 2, 0.09, 0);   // timbered upper storey below the gable
      for (const s of [-1, 1]) {   // gable roof slopes running back into the main roof
        const len = Math.hypot(hw + 0.25, y1 - y0 + 0.2), ang = Math.atan2(y1 - y0 + 0.2, hw + 0.25);
        L.add('tile', mbox(len, 0.1, 5.2), gx + s * (hw + 0.25) / 2, (y0 + y1) / 2 - 0.05, -2.2, [0, 0, s * -ang]);
      }
      L.span('white', gx - hw - 0.2, gx + hw + 0.2, y0 - 0.12, y0, 0.0, 0.3);
    }
    L.add('clock', new THREE.CircleGeometry(0.5, 24), 0, 8.45, 0.11, 0);
    // balustraded cupola with a lead cap and vane, on the main ridge (ridge at 7.0 + 3.4, centre of the depth: z = −5)
    const cz = -5, ry = 10.2;
    L.span('white', -0.9, 0.9, ry, ry + 0.9, cz - 0.9, cz + 0.9);
    for (let i = 0; i <= 8; i++) for (const s of [-1, 1]) { const t = -0.9 + i * 0.225; L.span('white', t - 0.03, t + 0.03, ry + 0.9, ry + 1.25, cz + s * 0.9 - 0.03, cz + s * 0.9 + 0.03); L.span('white', s * 0.9 - 0.03, s * 0.9 + 0.03, ry + 0.9, ry + 1.25, cz + t - 0.03, cz + t + 0.03); }
    L.span('white', -0.95, 0.95, ry + 1.25, ry + 1.32, cz - 0.95, cz + 0.95);
    for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) L.span('white', sx - 0.06, sx + 0.06, ry + 0.9, ry + 2.1, cz + sz - 0.06, cz + sz + 0.06);
    L.add('lead', new THREE.ConeGeometry(0.85, 1.3, 4, 1).rotateY(Math.PI / 4), 0, ry + 2.75, cz);
    L.span('lead', -0.02, 0.02, ry + 3.4, ry + 4.4, cz - 0.02, cz + 0.02); L.span('lead', -0.35, 0.35, ry + 4.1, ry + 4.16, cz - 0.015, cz + 0.015);
    L.add('lead', new THREE.ConeGeometry(0.08, 0.18, 4).rotateZ(-Math.PI / 2), 0.4, ry + 4.13, cz);
    const [ox, oz] = pw(cx, 0), rotY = Math.atan2(PF[0], PF[1]);
    const gm = new THREE.Matrix4().compose(new THREE.Vector3(ox, 0, oz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(1, 1, 1));
    for (const [k, list] of L.parts) for (const geo of list) B.addM(k, geo, gm);   // merged with the rest of the Parks dressing
    L.parts.clear();
    const g = { rotation: { y: rotY } };
    for (let i = 0; i <= 5; i++) { const x = -8 + i * 3.2; const [wx, wz] = pw(cx - x, 2.44); col.addCircle(wx, wz, 0.15, { tag: 'post' }); }
    // clock hands (dynamic, 2 tiny meshes)
    const hands = new THREE.Group(); hands.position.set(ox, 0, oz); hands.rotation.y = g.rotation.y; game.worldScene.add(hands);
    const mk = (len, w) => { const m = new THREE.Mesh(mbox(w, len, 0.02).translate(0, len / 2, 0), mats.black); m.position.set(0, 8.45, 0.13); hands.add(m); return m; };
    pv.clock = { hour: mk(0.28, 0.05), minute: mk(0.42, 0.035) };
  }

  // ------------------------------------------------------------------------------- cricket square + pitch
  {
    const [cx, cz] = CRICKET.c, [ux, uz] = CRICKET.u, h = Math.atan2(ux, uz);
    B.add('square', new THREE.PlaneGeometry(24, 22).rotateX(-Math.PI / 2), cx, 0.046, cz, h);
    B.add('pitch', new THREE.PlaneGeometry(3.05, 22.6).rotateX(-Math.PI / 2), cx, 0.05, cz, h);
    for (const e of [-1, 1]) for (const k of [-1, 0, 1]) {
      const along = e * 10.06, side = k * 0.11, x = cx + ux * along + uz * side, z = cz + uz * along - ux * side;
      B.add('white', new THREE.CylinderGeometry(0.018, 0.018, 0.71, 6), x, 0.355, z);
    }
  }

  // ------------------------------------------------------------------------------- High Bridge ("Rainbow Bridge")
  // Built 1923–24; called the Rainbow Bridge for its arched shape. The game is flat, so the walkway stays at ground
  // level and the arch is drawn as the two concrete side ribs rising over the river, with a hand-rail on top.
  // North pass (photo comparison north, item 4): the real bridge is a high, steep concrete arch with white iron railings.
  // It is now a real hump: the deck rises RAINBOW.rise over the river and world.groundHeight follows it, so the player
  // and the walkers climb over. Rise and thickness are a GUESS from photographs. `?north=0`: the old flat deck.
  if (NORTH) {
    const dx = B2[0] - B1[0], dz = B2[1] - B1[1], len = Math.hypot(dx, dz), ex = dx / len, ez = dz / len, nx = -ez, nz = ex;
    const EXT = RAINBOW.ext, LL = len + EXT * 2, N = 32, HW = 1.3;
    const hump = (a) => { const t = (a + EXT) / LL; return t <= 0 || t >= 1 ? 0 : RAINBOW.rise * 0.5 * (1 - Math.cos(t * Math.PI * 2)); };
    const soffit = (a) => { const u = Math.abs(2 * (a + EXT) / LL - 1); return Math.max(0, hump(a) - 0.4 - 2.4 * u * u); };
    const strip = (rows, key) => {      // rows: [[pA, pB], …] quads between consecutive rows
      const pos = [], idx = [];
      for (const [p, q] of rows) pos.push(p[0], p[1], p[2], q[0], q[1], q[2]);
      for (let i = 0; i < rows.length - 1; i++) { const o = i * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3, o, o + 1, o + 2, o + 1, o + 3, o + 2); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const uv = new Float32Array((pos.length / 3) * 2); for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = (pos[i * 3] * ex + pos[i * 3 + 2] * ez) / 2; uv[i * 2 + 1] = (pos[i * 3 + 1] + pos[i * 3] * nx + pos[i * 3 + 2] * nz) / 2; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      B.addM(key, geo, new THREE.Matrix4());
    };
    const at = (a, o, y) => [B1[0] + ex * a + nx * o, y, B1[1] + ez * a + nz * o];
    const As = Array.from({ length: N + 1 }, (_, i) => -EXT + (LL * i) / N);
    strip(As.map((a) => [at(a, -HW, hump(a) + 0.05), at(a, HW, hump(a) + 0.05)]), 'concrete');                       // the deck
    strip(As.map((a) => [at(a, -HW - 0.2, soffit(a)), at(a, HW + 0.2, soffit(a))]), 'concrete');                    // the soffit
    for (const s of [-1, 1]) {
      const o = s * (HW + 0.2);
      strip(As.map((a) => [at(a, o, soffit(a)), at(a, o, hump(a) + 0.22)]), 'concrete');                             // the arch's face
      strip(As.map((a) => [at(a, o - s * 0.2, hump(a) + 0.22), at(a, o, hump(a) + 0.22)]), 'concrete');              // the kerb's top
      // white iron railing: posts, top rail, mid rail
      for (let i = 0; i <= N; i += 2) {
        const a = As[i], p = at(a, o - s * 0.1, hump(a) + 0.22);
        B.add('white', mbox(0.045, 1.05, 0.045), p[0], p[1] + 0.525, p[2]);
        if (i < N) { const a2 = As[i + 2], q = at(a2, o - s * 0.1, hump(a2) + 0.22), run = Math.hypot(a2 - a, q[1] - p[1]);
          for (const h of [1.05, 0.55]) B.add('white', mbox(0.04, 0.04, run), (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + h, (p[2] + q[2]) / 2, [-Math.atan2(q[1] - p[1], a2 - a), Math.atan2(ex, ez), 0, 'YXZ']); }
      }
      col.addSegment(B1[0] - ex * EXT + nx * o, B1[1] - ez * EXT + nz * o, B2[0] + ex * EXT + nx * o, B2[1] + ez * EXT + nz * o, { tag: 'parapet' });
    }
    { const prev = W.groundHeight, x0 = B1[0], z0 = B1[1], lim = HW + 0.25;
      W.groundHeight = (x, z) => { const px = x - x0, pz = z - z0, a = px * ex + pz * ez; if (a > -EXT && a < len + EXT && Math.abs(px * nx + pz * nz) < lim) return prev(x, z) + hump(a); return prev(x, z); }; }
  } else
  {
    const dx = B2[0] - B1[0], dz = B2[1] - B1[1], len = Math.hypot(dx, dz), ex = dx / len, ez = dz / len, nx = -ez, nz = ex;
    const ext = 1.5, L0 = -ext, L1 = len + ext, N = 24, rise = 1.25;
    const deck = [[B1[0] - ex * ext, B1[1] - ez * ext], [B2[0] + ex * ext, B2[1] + ez * ext]];
    B.addM('concrete', W.ribbon(deck, 2.7, 0.06), new THREE.Matrix4());
    for (const s of [-1, 1]) {
      const pos = [], idx = [];
      const off = s * 1.42, th = 0.24;
      for (let i = 0; i <= N; i++) {
        const t = i / N, a = L0 + (L1 - L0) * t, top = 0.75 + rise * Math.sin(Math.PI * t), bot = Math.max(0.0, top - 0.75 - (1 - Math.sin(Math.PI * t)) * 0.0);
        const bx = B1[0] + ex * a, bz = B1[1] + ez * a;
        for (const o of [off - th / 2, off + th / 2]) { pos.push(bx + nx * o, bot, bz + nz * o, bx + nx * o, top, bz + nz * o); }
      }
      // faces: outer, inner, top
      for (let i = 0; i < N; i++) {
        const b = i * 4, n = b + 4;
        idx.push(b, n, b + 1, n, n + 1, b + 1);                 // side A
        idx.push(b + 2, b + 3, n + 2, n + 2, b + 3, n + 3);     // side B
        idx.push(b + 1, n + 1, b + 3, n + 1, n + 3, b + 3);     // top
        idx.push(b, b + 2, n, n, b + 2, n + 2);                 // underside
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const uv = new Float32Array((pos.length / 3) * 2); for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = (pos[i * 3] * ex + pos[i * 3 + 2] * ez) / 2; uv[i * 2 + 1] = pos[i * 3 + 1] / 2; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      B.addM('concrete', geo, new THREE.Matrix4());
      // hand-rail posts + rail following the arch
      for (let i = 0; i <= N; i += 2) {
        const t = i / N, a = L0 + (L1 - L0) * t, top = 0.75 + rise * Math.sin(Math.PI * t), bx = B1[0] + ex * a + nx * off, bz = B1[1] + ez * a + nz * off;
        B.add('post', mbox(0.04, 0.42, 0.04), bx, top + 0.21, bz);
        if (i < N) { const t2 = (i + 2) / N, a2 = L0 + (L1 - L0) * t2, top2 = 0.75 + rise * Math.sin(Math.PI * t2), seg = Math.hypot(a2 - a, top2 - top);
          B.add('post', mbox(0.05, 0.05, seg), bx + ex * (a2 - a) / 2, (top + top2) / 2 + 0.42, bz + ez * (a2 - a) / 2, [-Math.atan2(top2 - top, a2 - a), Math.atan2(ex, ez), 0, 'YXZ']); }
      }
      col.addSegment(B1[0] - ex * ext + nx * off, B1[1] - ez * ext + nz * off, B2[0] + ex * ext + nx * off, B2[1] + ez * ext + nz * off, { tag: 'parapet' });
    }
  }

  // ------------------------------------------------------------------------------- gate boards + dog bins
  const binSpots = [];
  for (const gt of GATES) {
    const [gx, gz] = gt.p; let ix = 430 - gx, iz = -760 - gz; const l = Math.hypot(ix, iz); ix /= l; iz /= l;   // into the Parks
    const sx = -iz, sz = ix, bx = gx + sx * 2.2 - ix * 0.6, bz = gz + sz * 2.2 - iz * 0.6, h = Math.atan2(-ix, -iz);   // board faces out of the Parks
    for (const o of [-0.42, 0.42]) B.box('post', bx + Math.cos(h) * o, 0, bz - Math.sin(h) * o, 0.07, 1.9, 0.07);
    B.add('signs', atlasPlane(1.0, 1.2, 0), bx + ix * -0.03, 1.25, bz + iz * -0.03, h);
    B.add('signs', atlasPlane(1.0, 1.2, 1), bx + ix * 0.03, 1.25, bz + iz * 0.03, h + Math.PI);
    col.addCircle(bx, bz, 0.25, { tag: 'sign' });
    binSpots.push([gx - sx * 2.4 + ix * 1.2, gz - sz * 2.4 + iz * 1.2, h]);
  }
  const QS = [[735, -645], [630, -690], [480, -795], [390, -870], [525, -900], [600, -810]];
  for (const [x, z] of QS) binSpots.push([x - 37, z - 37, 0.6]);
  for (const [x, z, h] of binSpots) {
    B.box('post', x, 0, z, 0.08, 0.95, 0.08);
    B.add('bin', new THREE.CylinderGeometry(0.2, 0.18, 0.42, 10), x + Math.sin(h) * 0.12, 0.85, z + Math.cos(h) * 0.12);
    B.add('signs', atlasPlane(0.22, 0.22, 2), x + Math.sin(h) * 0.33, 0.85, z + Math.cos(h) * 0.33, h);
    col.addCircle(x, z, 0.25, { tag: 'bin' });
  }

  const statics = B.build(mats, { shadows: true, name: 'parks-dress' });
  W.addStatic(statics);

  // ------------------------------------------------------------------------------- pond: lily pads + ducks
  const pond = game.map.areas.find((a) => a.id === 'r62916');
  const pondObj = { ducks: null };
  if (pond) {
    const poly = pond.poly, inP = W.util.pointInPoly;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity; for (const [x, z] of poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    const edgeD = (x, z) => { let d = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ddx = b[0] - a[0], ddz = b[1] - a[1], l2 = ddx * ddx + ddz * ddz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * ddx + (z - a[1]) * ddz) / l2)); d = Math.min(d, Math.hypot(a[0] + ddx * t - x, a[1] + ddz * t - z)); } return d; };
    const rng = W.rng(1925), pads = [];
    for (let k = 0; k < 900 && pads.length < 70; k++) { const x = minX + rng() * (maxX - minX), z = minZ + rng() * (maxZ - minZ); if (inP(x, z, poly) && edgeD(x, z) < 7 && edgeD(x, z) > 0.8) pads.push([x, z, rng() * 6.28, 0.6 + rng() * 0.7]); }
    const padG = new THREE.CircleGeometry(0.4, 12, 0.25, Math.PI * 2 - 0.5).rotateX(-Math.PI / 2);
    const padIM = new THREE.InstancedMesh(padG, W.layerMaterial(new THREE.MeshStandardMaterial({ color: 0x3f6b2a, roughness: 0.6, side: THREE.DoubleSide }), 'marking'), pads.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
    pads.forEach(([x, z, a, s], i) => { m4.compose(v.set(x, 0.06, z), q.setFromAxisAngle(up, a), sc.set(s, 1, s)); padIM.setMatrixAt(i, m4); });
    padIM.receiveShadow = true; game.worldScene.add(padIM);
    // ducks: mallards (brown body, green head, yellow bill), vertex-coloured
    const part = (geo, c) => { const n = geo.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo.toNonIndexed(); };
    const body = part(new THREE.SphereGeometry(0.16, 10, 8).scale(1, 0.7, 1.6), 0x7a6a58), head = part(new THREE.SphereGeometry(0.08, 8, 6).translate(0, 0.17, 0.2), 0x1e5a32), bill = part(new THREE.ConeGeometry(0.03, 0.09, 6).rotateX(Math.PI / 2).translate(0, 0.16, 0.31), 0xe0b030), tail = part(new THREE.ConeGeometry(0.05, 0.12, 5).rotateX(-Math.PI / 2 - 0.5).translate(0, 0.06, -0.26), 0x2a2a2a);
    const geos = [body, head, bill, tail]; for (const g2 of geos) { g2.deleteAttribute('uv'); }
    const duckG = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'color']) { const arrs = geos.map((g2) => g2.attributes[k].array); const tot = arrs.reduce((s, a) => s + a.length, 0), out = new Float32Array(tot); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } duckG.setAttribute(k, new THREE.BufferAttribute(out, 3)); }
    const ducks = [];
    for (let k = 0; k < 300 && ducks.length < 6; k++) { const x = minX + rng() * (maxX - minX), z = minZ + rng() * (maxZ - minZ); if (inP(x, z, poly) && edgeD(x, z) > 3.5) ducks.push({ cx: x, cz: z, r: 1.5 + rng() * 2.5, ph: rng() * 6.28, sp: (rng() < 0.5 ? -1 : 1) * (0.1 + rng() * 0.12) }); }
    const duckIM = new THREE.InstancedMesh(duckG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), Math.max(1, ducks.length));
    duckIM.count = ducks.length; duckIM.castShadow = true; duckIM.frustumCulled = false; game.worldScene.add(duckIM);
    pondObj.ducks = { im: duckIM, list: ducks, poly, inP, c: [(minX + maxX) / 2, (minZ + maxZ) / 2] };
  }

  let t = 0;
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
  return {
    pavilion: pv, pond: pondObj, quadratBins: QS,
    /** read-only: distance from (x,z) to the nearest pond duck (same orbit maths as update), or Infinity */
    nearestDuck(x, z) {
      const D = pondObj.ducks; if (!D) return Infinity;
      let best = Infinity;
      for (let i = 0; i < D.list.length; i++) { const d = D.list[i], a = d.ph + t * d.sp, e = Math.hypot(d.cx + Math.cos(a) * d.r - x, d.cz + Math.sin(a) * d.r - z); if (e < best) best = e; }
      return best;
    },
    update(dt, px, pz) {
      t = (game.time.now() % 3600000) / 1000;      // shared clock: the pond ducks are in the same place for every player
      const h = game.time.hour;
      if (pv.clock) { pv.clock.minute.rotation.z = -((h % 1) * Math.PI * 2); pv.clock.hour.rotation.z = -(((h % 12) / 12) * Math.PI * 2); pv.clock.minute.updateMatrix(); pv.clock.hour.updateMatrix(); }
      const D = pondObj.ducks; if (!D || Math.hypot(px - D.c[0], pz - D.c[1]) > 180) return;
      const m4 = _m4, q = _q, up = _up, v = _v, one = _one;
      D.list.forEach((d, i) => {
        const a = d.ph + t * d.sp, x = d.cx + Math.cos(a) * d.r, z = d.cz + Math.sin(a) * d.r;
        const hd = Math.atan2(-Math.sin(a) * d.sp, Math.cos(a) * d.sp);
        m4.compose(v.set(x, 0.03 + Math.sin(t * 2 + i) * 0.01, z), q.setFromAxisAngle(up, hd), one); D.im.setMatrixAt(i, m4);
      });
      D.im.instanceMatrix.needsUpdate = true;
    },
  };
}
