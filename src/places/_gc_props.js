// Airfield props for places/gliding_club.js — plain boxes with the right sizes and colours, merged into one draw.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SITE, h01 } from '../systems/_glide_site.js';

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
function piece(geo, rgb, x, y, z, ry = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.rotateY(ry); g.translate(x, y, z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = rgb[0]; c[i * 3 + 1] = rgb[1]; c[i * 3 + 2] = rgb[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
/** a box w × h × d standing on y0, centred (lx, lz) in a frame at (x, z) turned by ry */
function boxAt(out, w, h, d, rgb, x, y0, z, ry = 0, lx = 0, lz = 0, ly = 0) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(lx, ly + h / 2, lz);
  out.push(piece(g, rgb, x, y0, z, ry));
}
function cylAt(out, r, len, rgb, x, y, z, ry, lx, ly, lz, axis = 'x') {
  const g = new THREE.CylinderGeometry(r, r, len, 12); if (axis === 'x') g.rotateZ(Math.PI / 2); g.translate(lx, ly, lz);
  out.push(piece(g, rgb, x, y, z, ry));
}

function geoAt(out, g, rgb, x, y, z, ry = 0) { out.push(piece(g, rgb, x, y, z, ry)); }

export function buildProps(ground) {
  const P = [];
  const cream = lin(0xe8e2cc), white = lin(0xf2f2ee), dark = lin(0x22262a), grey = lin(0x7b8187), green = lin(0x3f5a3a), red = lin(0xb8322a), rust = lin(0x8a5a3a), glass = lin(0x2c3a46), wood = lin(0x7a5a3a), yellow = lin(0xd8b030);
  // ---- launch-point caravan (an old touring caravan: the duty instructor's office), side window band, a mast aerial
  {
    const [x, z, h] = SITE.launchBus, y = ground(x, z);
    boxAt(P, 2.3, 2.1, 6.2, cream, x, y + 0.45, z, h);
    boxAt(P, 2.32, 0.55, 4.6, glass, x, y + 1.6, z, h, 0, 0.3);
    boxAt(P, 2.32, 0.18, 6.2, lin(0x6b8fae), x, y + 0.85, z, h);
    cylAt(P, 0.3, 0.2, dark, x, y + 0.3, z, h, 1.2, 0, 0.4); cylAt(P, 0.3, 0.2, dark, x, y + 0.3, z, h, -1.2, 0, 0.4);
    boxAt(P, 0.06, 4.5, 0.06, grey, x, y + 2.55, z, h, 0.8, -2.5);
    // a striped awning along the door side (red / cream), on two poles
    for (let k = 0; k < 8; k++) {
      const g = new THREE.BoxGeometry(2.0, 0.04, 0.5); g.rotateX(0); g.rotateZ(-0.22); g.translate(2.05, 2.35, -1.75 + k * 0.5);
      geoAt(P, g, k % 2 ? cream : lin(0xb53a2e), x, y, z, h);
    }
    boxAt(P, 0.05, 2.15, 0.05, grey, x, y, z, h, 3.0, -1.8); boxAt(P, 0.05, 2.15, 0.05, grey, x, y, z, h, 3.0, 1.95);
    // a table and two chairs out front, the briefing board
    boxAt(P, 1.2, 0.05, 0.8, white, x, y + 0.72, z, h, 2.4, 0.5); boxAt(P, 0.05, 0.7, 0.05, grey, x, y, z, h, 2.4, 0.5);
    boxAt(P, 1.4, 1.0, 0.08, wood, x + 9, y + 0.9, z - 3, 0); boxAt(P, 1.25, 0.85, 0.09, white, x + 9, y + 0.97, z - 3.01, 0);
    boxAt(P, 0.08, 1.0, 0.08, wood, x + 8.4, y, z - 3, 0); boxAt(P, 0.08, 1.0, 0.08, wood, x + 9.6, y, z - 3, 0);
  }
  // ---- the winch at the far end: a lorry chassis with two cable drums behind the cab, a mesh guard
  {
    const [x, z] = SITE.winch, y = ground(x, z), ry = -Math.PI / 2;     // faces back down the field (west)
    boxAt(P, 2.4, 0.9, 7.2, dark, x, y + 0.5, z, ry);
    boxAt(P, 2.45, 1.9, 2.0, lin(0x2d5a8a), x, y + 1.3, z, ry, 0, 2.5);
    boxAt(P, 2.0, 0.6, 1.95, glass, x, y + 2.3, z, ry, 0, 2.5);
    // two 1.3 m cable drums side by side across the bed, cable wound on them, in a mesh cage
    for (const s of [-0.55, 0.55]) { cylAt(P, 0.65, 0.95, lin(0x55595e), x, y + 2.05, z, ry, s, 0, -1.3); cylAt(P, 0.5, 0.97, lin(0x3a3c3e), x, y + 2.05, z, ry, s, 0, -1.3); }
    boxAt(P, 2.3, 0.1, 2.6, lin(0x9aa0a4), x, y + 2.9, z, ry, 0, -1.3);
    for (const [lx, lz] of [[-1.12, -2.55], [1.12, -2.55], [-1.12, -0.05], [1.12, -0.05]]) boxAt(P, 0.07, 1.95, 0.07, lin(0x9aa0a4), x, y + 1.0, z, ry, lx, lz);
    for (let k = 0; k < 6; k++) { boxAt(P, 2.3, 0.03, 0.03, lin(0x8a9094), x, y + 1.2 + k * 0.3, z, ry, 0, -2.57); boxAt(P, 0.03, 0.03, 2.5, lin(0x8a9094), x, y + 1.2 + k * 0.3, z, ry, 1.14, -1.3); boxAt(P, 0.03, 0.03, 2.5, lin(0x8a9094), x, y + 1.2 + k * 0.3, z, ry, -1.14, -1.3); }
    // the cable guides at the back (where the two cables come in) and a bright yellow guard rail
    boxAt(P, 2.0, 0.3, 0.3, yellow, x, y + 1.0, z, ry, 0, -3.5); boxAt(P, 0.2, 0.9, 0.2, dark, x, y + 1.0, z, ry, 0.55, -3.45); boxAt(P, 0.2, 0.9, 0.2, dark, x, y + 1.0, z, ry, -0.55, -3.45);
    boxAt(P, 0.18, 0.12, 0.18, dark, x, y + 3.2, z, ry, 0, 2.5);                          // the beacon's base on the cab roof
    for (const s of [-1, 1]) for (const zz of [2.6, -1.4, -2.6]) cylAt(P, 0.5, 0.35, dark, x, y + 0.5, z, ry, s * 1.15, 0, zz);
    // the cable-retrieve Land Rover beside it
    const lx = x - 8, lz = z + 12;
    boxAt(P, 1.8, 1.25, 4.4, green, lx, y + 0.55, lz, 0.3); boxAt(P, 1.75, 0.7, 2.2, green, lx, y + 1.8, lz, 0.3, 0, -0.8);
    boxAt(P, 1.7, 0.45, 0.5, glass, lx, y + 1.85, lz, 0.3, 0, 0.6);
    for (const s of [-1, 1]) for (const zz of [1.4, -1.4]) cylAt(P, 0.4, 0.3, dark, lx, y + 0.4, lz, 0.3, s * 0.85, 0, zz);
  }
  // ---- glider trailers: a row of long boxes (each holds a dismantled single-seater) along the hedge east of the hangar
  for (let i = 0; i < SITE.trailers; i++) {
    const x = 1860 + i * 6.5, z = -592, y = ground(x, z), c = [white, lin(0xd6dbe0), lin(0xc8cfc0), white, lin(0xdcd3be), white][i % 6];
    // a white GRP tube: a squashed cylinder 9 m long, rounded nose cap at the front, a flat tail door, a dark seam
    const ry = 0.02 * (h01(i) - 0.5), body = new THREE.CylinderGeometry(0.75, 0.75, 8.3, 14, 1, true); body.rotateX(Math.PI / 2); body.scale(1, 1.08, 1);
    geoAt(P, body.translate(0, 1.4, -0.35), c, x, y, z, ry);
    const nose = new THREE.SphereGeometry(0.75, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); nose.rotateX(Math.PI / 2); nose.scale(1, 1.08, 1.25);
    geoAt(P, nose.translate(0, 1.4, 3.8), c, x, y, z, ry);
    const tailG = new THREE.CircleGeometry(0.75, 14); tailG.rotateY(Math.PI); tailG.scale(1, 1.08, 1); geoAt(P, tailG.translate(0, 1.4, -4.5), lin(0xc4c8cc), x, y, z, ry);
    boxAt(P, 1.52, 0.04, 8.2, lin(0x8f969c), x, y + 1.38, z, ry, 0, -0.35);
    boxAt(P, 0.1, 0.12, 2.2, dark, x, y + 0.45, z, ry, 0, 5.4);
    cylAt(P, 0.3, 0.2, dark, x, y + 0.3, z, 0, 0.85, 0, -0.6); cylAt(P, 0.3, 0.2, dark, x, y + 0.3, z, 0, -0.85, 0, -0.6);
  }
  // ---- the field gate (five-bar, swung open) and its posts; the signpost at the lane end
  {
    const [gx, gz] = SITE.gate, y = ground(gx, gz);
    boxAt(P, 0.2, 1.4, 0.2, wood, gx - 5, y, gz); boxAt(P, 0.2, 1.4, 0.2, wood, gx + 5, y, gz);
    for (let b = 0; b < 5; b++) boxAt(P, 0.08, 0.1, 3.4, wood, gx - 5, y + 0.25 + b * 0.25, gz, 0, 0, -1.8);
    const L0 = SITE.lane[0];
    boxAt(P, 0.12, 2.3, 0.12, white, L0[0] - 4.2, ground(L0[0], L0[1]), L0[1] - 1);
  }
  // ---- the hangar's north front (map building gc_hangar): two tall sliding doors half open on their top track, the dark
  // inside between them with a white glider's nose and wing root just in the light
  {
    const H = SITE.hangar, zf = H[2][1], x0 = H[0][0], x1 = H[1][0], cx = (x0 + x1) / 2, y = ground(cx, zf - 2), door = lin(0xa3ada4), rib = lin(0x8b968d);
    boxAt(P, 17.5, 6.6, 0.06, lin(0x0e0f10), cx, y, zf - 0.06);                       // the opening (dark inside)
    for (const [dx, dz] of [[-12.6, -0.32], [12.6, -0.62]]) {
      boxAt(P, 10.4, 7.0, 0.12, door, cx + dx, y, zf + dz);
      for (let k = 0; k < 14; k++) boxAt(P, 0.12, 7.0, 0.08, rib, cx + dx - 5 + k * 0.77, y, zf + dz - 0.08);
      boxAt(P, 10.4, 0.25, 0.1, lin(0xd8c23a), cx + dx, y + 0.1, zf + dz - 0.1);          // yellow kick strip
    }
    boxAt(P, x1 - x0 + 2, 0.22, 0.28, dark, cx, y + 7.05, zf - 0.5);                   // the top track
    // the glider inside: nose out of the shadow, a wing root behind it
    const nose = new THREE.SphereGeometry(0.4, 14, 10); nose.scale(1, 0.95, 3.4); geoAt(P, nose.translate(0, 1.0, 0), white, cx + 2, y, zf - 0.5);
    boxAt(P, 0.26, 0.12, 0.7, lin(0xc8202a), cx + 2, y + 1.0, zf - 1.2);
    const wing = new THREE.BoxGeometry(8, 0.14, 1.2); wing.rotateZ(0.06); geoAt(P, wing.translate(-3.5, 1.35, 0), lin(0xb8bcbf), cx + 2, y, zf - 0.2);
    boxAt(P, 0.18, 0.3, 0.18, dark, cx + 2, y, zf - 1.9);
  }
  // ---- clubhouse veranda on the field side: a deck, posts, a lean-to roof, a rail, chairs
  {
    const C = SITE.clubhouse, x0 = C[0][0], x1 = C[1][0], zf = C[2][1], cx = (x0 + x1) / 2, y = ground(cx, zf - 1.5);
    boxAt(P, x1 - x0 + 1, 0.25, 3.2, lin(0x8c6d4c), cx, y, zf - 1.6);
    for (let k = 0; k <= 6; k++) boxAt(P, 0.14, 2.75, 0.14, white, x0 - 0.3 + k * (x1 - x0 + 0.6) / 6, y + 0.25, zf - 3.05);
    const roof = new THREE.BoxGeometry(x1 - x0 + 1.4, 0.1, 3.6); roof.rotateX(-0.12); geoAt(P, roof.translate(0, 3.1, -1.7), lin(0x5b6168), cx, y, zf);
    boxAt(P, x1 - x0 + 0.6, 0.06, 0.06, white, cx, y + 1.15, zf - 3.05); boxAt(P, x1 - x0 + 0.6, 0.06, 0.06, white, cx, y + 0.7, zf - 3.05);
    for (let k = 0; k < 5; k++) { const xx = x0 + 2.5 + k * 4.6; boxAt(P, 0.5, 0.45, 0.5, k % 2 ? lin(0x2f5d8a) : lin(0x3a6b3e), xx, y + 0.25, zf - 1.6); boxAt(P, 0.5, 0.5, 0.06, k % 2 ? lin(0x2f5d8a) : lin(0x3a6b3e), xx, y + 0.7, zf - 1.37); }
  }
  // ---- clubhouse odds: picnic benches, a flagpole-ish wind mast by the hangar door, the fuel-less bowser
  for (let i = 0; i < 3; i++) { const x = 1640 + i * 4, z = -596, y = ground(x, z); boxAt(P, 1.8, 0.06, 0.7, wood, x, y + 0.72, z); boxAt(P, 1.8, 0.05, 0.3, wood, x, y + 0.44, z, 0, 0, 0.55); boxAt(P, 1.8, 0.05, 0.3, wood, x, y + 0.44, z, 0, 0, -0.55); }
  boxAt(P, 0.6, 0.8, 0.6, yellow, 1846, ground(1846, -590), -590);
  boxAt(P, 0.6, 0.8, 0.6, red, 1846, ground(1846, -594), -594);
  void rust;
  const geo = mergeGeometries(P, false);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'gliding_club:props';
  const grp = new THREE.Group(); grp.name = 'gliding_club'; grp.add(mesh);
  // the winch's amber beacon (blinks while a launch is on: gliding_club.js), a tiny unlit sphere on the cab roof
  {
    const [x, z] = SITE.winch, y = ground(x, z);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), new THREE.MeshBasicMaterial({ color: 0x3a2200 }));
    b.position.set(x - 2.5, y + 3.45, z); b.name = 'gliding_club:beacon'; grp.add(b); grp.userData.beacon = b;
  }
  return grp;
}

/**
 * windsock on a 6 m mast: five cone segments (orange / white / orange / white / orange) chained from the mouth hoop, each
 * following the one before with a lag, so a gust ripples down it; it fills and points downwind, droops in a calm.
 * One small dynamic mesh (1 draw).
 */
export function buildWindsock() {
  const group = new THREE.Group(); group.name = 'gliding_club:windsock';
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 6, 8).translate(0, 3, 0), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  group.add(mast);
  const pivot = new THREE.Group(); pivot.position.y = 5.9; group.add(pivot);
  const SEG = 5, RING = 12, LEN = 0.6, R0 = 0.42, R1 = 0.17, ST = SEG + 1;
  const pos = new Float32Array(ST * RING * 3), col = new Float32Array(ST * RING * 3), idx = [];
  for (let s = 0; s < SEG; s++) for (let i = 0; i < RING; i++) {
    const a = s * RING + i, b = s * RING + (i + 1) % RING, c = a + RING, d = b + RING;
    idx.push(a, c, b, b, c, d);
  }
  // colour per station (flat bands: duplicate-free, so bands blend over one segment; fine at this size)
  for (let s = 0; s < ST; s++) for (let i = 0; i < RING; i++) col.set(s === ST - 1 ? [0.95, 0.35, 0.05] : s % 2 ? [0.95, 0.95, 0.95] : [0.95, 0.35, 0.05], (s * RING + i) * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 1.5), 3.5);
  const sock = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }));
  sock.frustumCulled = false; pivot.add(sock);
  const ang = new Float32Array(ST * 2);           // per station: droop (x), sway (y) — lagged
  const write = (fill, t) => {
    // centreline from the hoop: each segment bends a little more than the last (droop), with a travelling flutter
    let px = 0, py = 0, pz = 0, ax = 0, ay = 0;
    for (let s = 0; s < ST; s++) {
      if (s > 0) {
        const tx = (1 - fill) * (0.12 + 0.07 * s) + Math.sin(t * 7.1 - s * 1.3) * 0.05 * fill, ty = Math.sin(t * 5.3 - s * 1.1) * 0.09 * fill;
        ang[s * 2] += (tx - ang[s * 2]) * 0.25; ang[s * 2 + 1] += (ty - ang[s * 2 + 1]) * 0.25;
        ax += ang[s * 2]; ay += ang[s * 2 + 1];
        px += Math.sin(ay) * Math.cos(ax) * LEN; py -= Math.sin(ax) * LEN; pz += Math.cos(ay) * Math.cos(ax) * LEN;
      }
      // a slack sock is thinner at the tail and wrinkled
      const r = (R0 + (R1 - R0) * (s / SEG)) * (s === 0 ? 1 : 0.55 + 0.45 * fill) * (1 + 0.04 * Math.sin(t * 11 - s * 2));
      for (let i = 0; i < RING; i++) {
        const a = (i / RING) * Math.PI * 2, cx = Math.cos(a) * r, cy = Math.sin(a) * r, k = (s * RING + i) * 3;
        // ring in the plane across the local direction (yaw ay, pitch ax)
        pos[k] = px + cx * Math.cos(ay); pos[k + 1] = py + cy * Math.cos(ax); pos[k + 2] = pz - cx * Math.sin(ay) + cy * Math.sin(ax);
      }
    }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals();
  };
  let acc = 1;
  return {
    group,
    /** wx, wz: wind (m/s) */
    set(wx, wz, dt, t) {
      const sp = Math.hypot(wx, wz), dir = Math.atan2(wx, wz), fill = Math.min(1, sp / 7.5);   // 15 kt fills it straight out
      pivot.rotation.y = dir + Math.sin(t * 3.1) * 0.05 * fill;
      acc += dt; if (acc < 1 / 30) return; acc = 0;
      write(fill, t);
    },
  };
}

/** "GLIDING CLUB" board (plain lettering, no logo) */
export function signTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext && c.getContext('2d'); if (!g || !g.fillText) return null;
  g.fillStyle = '#f4f1e6'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#1d3a5f'; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = '#1d3a5f'; g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GLIDING CLUB', 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
