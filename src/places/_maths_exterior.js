// Andrew Wiles Building (Mathematical Institute) exterior, built in place of OSM way 242287396 (owned by places/maths.js).
//
// Sources: RVA photographs (2013) and Wikimedia Commons photos (Oct 2013, 2014, 2020, 2024); ROQ leaflet; Hardscape case study.
//  - two wings (North along the service road, South behind Radcliffe Humanities) joined by a glazed link: a low entrance
//    pavilion with a white fascia and a sloping glass roof facing the Penrose paving (east), rising to the glass-walled
//    first-floor common room that faces the Tower of the Winds (west); revolving door below it.
//  - facades: a large square grid of pale buff stone(-coloured) piers and floor bands with deep reveals; each bay holds a
//    tall window beside a dark bronze louvred shutter panel (positions alternate); green roof + rooftop plant screens;
//    roofline lowest towards Woodstock Road.
//  - Penrose paving: P3 rhombs in Royal White and Kobra Grey granite with polished stainless-steel arcs.
// Guessed: where the link meets the wings (the OSM outline is a single polygon), bay width (3.3 m), storey heights,
// the one-storey step at the Woodstock Road end, tile size (0.9 m edge), which granite is on which rhomb.
import * as THREE from 'three';
import { repaintableFn } from '../world/_tex_keep.js';
import { Batch, lerp2, signedArea } from './_maths_geo.js';
import { penroseTriangles, drawPenrose, PHI } from './_maths_penrose.js';

export const AWB = (() => {
  const E0 = [-208.6, -620.1], E1 = [-228.2, -592.0];                 // north-west edge (faces the Observatory)
  const Wn = lerp2(E0, E1, 0.25), Ws = lerp2(E0, E1, 0.75);
  const En = [-176.0, -610.0], Es = [-184.5, -598.0];                 // entrance face onto the Penrose paving
  const C0 = [-173.8, -613.5];
  const northLow = [[-151.9, -649.2], [-141.8, -628.2], [-161.8, -619.0], [-172.0, -640.2]];
  const north = [[-172.0, -640.2], [-161.8, -619.0], C0, En, Wn, E0, [-204.7, -625.7]];
  const south = [Ws, E1, [-227.6, -590.8], [-208.3, -551.0], [-203.8, -541.7], [-194.8, -523.3], [-166.4, -536.4], [-169.4, -542.8],
    [-172.9, -549.9], [-181.2, -545.9], [-190.8, -564.9], [-187.1, -566.6], [-195.5, -583.5], Es];
  const link = [Wn, Ws, Es, En];
  const paving = [En, Es, [-180, -593], [-167, -599], [-169, -603], [-172, -610], C0];
  const eMid = lerp2(En, Es, 0.5), wMid = lerp2(Wn, Ws, 0.5);
  const ax = [wMid[0] - eMid[0], wMid[1] - eMid[1]], axL = Math.hypot(ax[0], ax[1]);
  const axis = { o: eMid, d: [ax[0] / axL, ax[1] / axL], L: axL };
  // outward normals of the two entrance faces
  const nE = (() => { const d = [Es[0] - En[0], Es[1] - En[1]], l = Math.hypot(d[0], d[1]); let n = [d[1] / l, -d[0] / l]; if (n[0] * -axis.d[0] + n[1] * -axis.d[1] < 0) n = [-n[0], -n[1]]; return n; })();
  const nW = (() => { const d = [Ws[0] - Wn[0], Ws[1] - Wn[1]], l = Math.hypot(d[0], d[1]); let n = [d[1] / l, -d[0] / l]; if (n[0] * axis.d[0] + n[1] * axis.d[1] < 0) n = [-n[0], -n[1]]; return n; })();
  return { E0, E1, Wn, Ws, En, Es, C0, north, northLow, south, link, paving, axis, eMid, wMid, nE, nW };
})();

const GROUND = 4.2, STOREY = 3.45, H = GROUND + 4 * STOREY, H_LOW = GROUND + 3 * STOREY, BAY = 3.3;
const LINK_LOW = 5.6, LINK_HIGH = 13.2, BOX_T = 0.7;     // glass roof from the entrance fascia up to the common-room box

/** height of the link roof at a point (by its position along the link axis) */
export function linkRoofY(x, z) {
  const a = AWB.axis, t = ((x - a.o[0]) * a.d[0] + (z - a.o[1]) * a.d[1]) / a.L;
  if (t >= BOX_T) return LINK_HIGH;
  return LINK_LOW + (LINK_HIGH - 0.6 - LINK_LOW) * Math.max(0, t) / BOX_T;
}

// ------------------------------------------------------------------------------------------------ textures
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

/** 2 bays × 2 storeys of infill: window + louvred bronze panel, alternating sides. Returns {map, emissive}. */
function infillTextures() {
  const W = 512, Hh = 512, c = canvas(W, Hh), g = c.getContext('2d'), e = canvas(W, Hh), ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, Hh);
  g.fillStyle = '#cbb994'; g.fillRect(0, 0, W, Hh);
  for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) {
    const x0 = bx * 256, y0 = by * 256, louvreLeft = (bx + by) % 2 === 1;
    const lx = louvreLeft ? x0 + 8 : x0 + 146, wx = louvreLeft ? x0 + 120 : x0 + 8, ww = 128;
    // window: dark blue-grey glass with sky reflection gradient + transom
    const gr = g.createLinearGradient(0, y0, 0, y0 + 256); gr.addColorStop(0, '#a9bcc6'); gr.addColorStop(0.5, '#6b818d'); gr.addColorStop(1, '#3e4c55');
    g.fillStyle = gr; g.fillRect(wx, y0 + 6, ww, 244);
    g.fillStyle = '#5b554c'; g.fillRect(wx, y0 + 6, ww, 4); g.fillRect(wx, y0 + 246, ww, 4); g.fillRect(wx + ww / 2 - 2, y0 + 6, 4, 244);
    ge.fillStyle = '#c99050'; ge.fillRect(wx + 4, y0 + 14, ww - 8, 228);
    ge.fillStyle = '#000'; ge.fillRect(wx + ww / 2 - 3, y0 + 6, 6, 244);
    // louvre panel: horizontal dark bronze blades
    g.fillStyle = '#26231f'; g.fillRect(lx, y0 + 6, 104, 244);
    for (let yy = y0 + 10; yy < y0 + 248; yy += 9) { g.fillStyle = '#5a5248'; g.fillRect(lx + 3, yy, 98, 5); g.fillStyle = '#7a7064'; g.fillRect(lx + 3, yy, 98, 1); }
  }
  return { map: tex(c), emissive: tex(e) };
}

/** ground-floor curtain wall, one bay × ground storey */
function groundGlassTexture() {
  const c = canvas(256, 320), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#8aa0ab'); gr.addColorStop(0.5, '#4a5e69'); gr.addColorStop(1, '#2b3940');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#3d3f40'; g.fillRect(0, 0, 256, 10); g.fillRect(0, 312, 256, 8); g.fillRect(124, 0, 8, 320); g.fillRect(0, 70, 256, 5);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(20, 320); g.lineTo(90, 80); g.lineTo(120, 80); g.lineTo(50, 320); g.fill();
  return tex(c);
}

/** link glazing: big panes with slim white-grey mullions (u: 2 m, v: 1.9 m per repeat) */
function linkGlassTexture(roof) {
  const c = canvas(256, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 256);
  if (roof) { gr.addColorStop(0, '#c9d8e0'); gr.addColorStop(1, '#a3b7c3'); } else { gr.addColorStop(0, '#b5c8d2'); gr.addColorStop(0.6, '#7d929e'); gr.addColorStop(1, '#62747e'); }
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = roof ? '#d8dcdc' : '#c9cdcd'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 0, 6, 256);
  if (roof) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(40, 30, 60, 20); }
  return tex(c);
}

function stoneTexture() {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#d8c7a0'; g.fillRect(0, 0, 128, 128);
  let a = 77; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = 0; i < 900; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(120,100,70,${r() * 0.12})` : `rgba(255,250,235,${r() * 0.12})`; g.fillRect(r() * 128, r() * 128, 2, 2); }
  g.fillStyle = 'rgba(90,75,55,0.25)'; g.fillRect(0, 0, 128, 1);
  return tex(c);
}

function signTexture() {
  const c = canvas(512, 256), g = c.getContext('2d');
  g.fillStyle = '#002147'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffffff'; g.font = 'bold 44px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'left';
  g.fillText('Mathematical', 34, 92); g.fillText('Institute', 34, 146);
  g.font = '28px "Helvetica Neue", Arial, sans-serif'; g.fillStyle = '#c8d3e2'; g.fillText('Andrew Wiles Building', 34, 206);
  return tex(c);
}

/** The Penrose forecourt texture: tiling clipped to the paving polygon's bounding square. */
function pavingTexture(bb, edge) {
  const size = Math.max(bb.maxX - bb.minX, bb.maxZ - bb.minZ), PX = 2048, scale = PX / size;
  const c = canvas(PX, PX), g = c.getContext('2d');
  g.fillStyle = '#8e8f8e'; g.fillRect(0, 0, PX, PX);
  // the sun sits in the middle of the forecourt; tiling coordinates = world (x, z) relative to that centre
  const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
  let r = edge, gens = 0; while (r < size * 0.9) { r *= PHI; gens++; }
  const tris = penroseTriangles(r, gens);
  const toPx = (x, z) => [(x + cx - bb.minX) * scale, (z + cz - bb.minZ) * scale];
  drawPenrose(g, tris, edge, toPx, scale, { thick: '#55585b', thin: '#c4c3bc', steel: '#eef2f4' });
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8;
  return { texture: t, size, tris };
}

// (memory pass: these paint the same picture for the same arguments, so their canvases go once the textures are on the
//  card and they are called again if the card ever needs a picture again — world/_tex_keep.js)
infillTextures = repaintableFn(infillTextures); pavingTexture = repaintableFn(pavingTexture); signTexture = repaintableFn(signTexture);

// ------------------------------------------------------------------------------------------------ build
export function buildExterior(game) {
  const world = game.world, col = game.worldCollider;
  const B = new Batch();
  const infill = infillTextures();
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  const mats = {
    stone: std({ map: stoneTexture(), roughness: 0.8 }),
    infill: std({ map: infill.map, emissiveMap: infill.emissive, emissive: 0xffc27a, emissiveIntensity: 0, roughness: 0.45, metalness: 0.1 }),
    ground: std({ map: groundGlassTexture(), emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.25, metalness: 0.2 }),
    roof: std({ color: 0x8d8f8c, roughness: 0.95 }),
    green: std({ color: 0x6f7d45, roughness: 1 }),
    plant: std({ color: 0xa6abad, roughness: 0.7, metalness: 0.2 }),
    clere: std({ map: linkGlassTexture(false), roughness: 0.15, metalness: 0.3, emissive: 0xfff0d8, emissiveIntensity: 0 }),
    glass: std({ map: linkGlassTexture(false), roughness: 0.12, metalness: 0.35, emissive: 0xfff0d8, emissiveIntensity: 0 }),
    glassRoof: std({ map: linkGlassTexture(true), roughness: 0.08, metalness: 0.45 }),
    white: std({ color: 0xf1f1ee, roughness: 0.5 }),
    frame: std({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
    sign: std({ map: signTexture(), roughness: 0.6 }),
  };
  world.registerNight(mats.infill, 1.0);
  world.registerNight(mats.ground, 0.8);
  world.registerNight(mats.glass, 0.7);
  world.registerNight(mats.clere, 0.6);

  const ccw = (p) => (signedArea(p) > 0 ? p : p.slice().reverse());   // outward = right-hand normal (dz, -dx)
  const linkEdges = new Set(); // keys of wing edges shared with the link (cut edges)
  const ek = (a, b) => [a.join(','), b.join(',')].sort().join('|');
  linkEdges.add(ek(AWB.En, AWB.Wn)); linkEdges.add(ek(AWB.Es, AWB.Ws));

  function wing(polyIn, h) {
    const poly = ccw(polyIn), n = poly.length;
    const storeys = [0, GROUND]; for (let y = GROUND + STOREY; y < h - 0.01; y += STOREY) storeys.push(y);
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.5) continue;
      const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L, nx = dz, nz = -dx, ry = Math.atan2(nx, nz);
      const isCut = linkEdges.has(ek(a, b));
      const bays = Math.max(1, Math.round(L / BAY)), bw = L / bays;
      for (let k = 0; k < bays; k++) {
        const s0 = k * bw, s1 = s0 + bw, m = (s0 + s1) / 2;
        const x0 = a[0] + dx * s0, z0 = a[1] + dz * s0, x1 = a[0] + dx * s1, z1 = a[1] + dz * s1;
        let yStart = 0;
        if (isCut) { const ly = linkRoofY(a[0] + dx * m, a[1] + dz * m); yStart = storeys.find((y) => y >= ly - 0.05) ?? h; if (yStart >= h) continue; }
        if (yStart < GROUND) B.wall('ground', x0, z0, x1, z1, 0, GROUND, bw, GROUND);
        const ys = Math.max(yStart, GROUND);
        // upper infill: u in half-textures (2 bays per repeat), v (2 storeys per repeat), aligned to storeys
        B.quad('infill', [x0, ys, z0], [x0, h, z0], [x1, h, z1], [x1, ys, z1],
          [k / 2, (ys - GROUND) / STOREY / 2], [k / 2, (h - GROUND) / STOREY / 2], [(k + 1) / 2, (h - GROUND) / STOREY / 2], [(k + 1) / 2, (ys - GROUND) / STOREY / 2]);
        // pier at the start of the bay (deep reveal frame). The piers stand 0.6 m proud and are let 2 cm into the wall
        // (their backs used to lie in the wall's own plane); the floor bands and the parapet stop 2 cm short of the
        // piers' faces, as courses between piers do — all three used to share one face and fought at every crossing.
        B.box('stone', x0 + nx * 0.29, (yStart + h + 0.5) / 2, z0 + nz * 0.29, 0.85, h + 0.5 - yStart, 0.62, ry);
      }
      if (!isCut) B.box('stone', b[0] + nx * 0.29, (h + 0.5) / 2, b[1] + nz * 0.29, 0.85, h + 0.5, 0.62, ry);
      // floor bands + parapet
      for (const y of storeys) {
        if (y === 0) continue;
        if (isCut && y < linkRoofY(a[0], a[1]) && y < linkRoofY(b[0], b[1])) continue;
        B.box('stone', (a[0] + b[0]) / 2 + nx * 0.265, y + 0.1, (a[1] + b[1]) / 2 + nz * 0.265, L + 0.85, 0.6, 0.63, ry);      // (-0.05 .. 0.58: its back is not in the piers' back plane either)
      }
      B.box('stone', (a[0] + b[0]) / 2 + nx * 0.085, h + 0.45, (a[1] + b[1]) / 2 + nz * 0.085, L + 0.6, 0.9, 0.97, ry);
      // collision: the pier faces
      if (!isCut) col.addSegment(a[0] + nx * 0.6, a[1] + nz * 0.6, b[0] + nx * 0.6, b[1] + nz * 0.6);
    }
    col.addPolygon(polyIn);
  }
  wing(AWB.northLow, H_LOW);
  wing(AWB.north, H);
  wing(AWB.south, H);
  // roofs (green roof on the low Woodstock Road end, as in the aerial photograph)
  B.flat('green', AWB.northLow, H_LOW + 0.05, false, 4);
  B.flat('roof', AWB.north, H + 0.05, false, 4);
  B.flat('roof', AWB.south, H + 0.05, false, 4);
  // rooftop plant screens and the atrium clerestories
  const onLine = (p, q, t, off, nrm) => [p[0] + (q[0] - p[0]) * t + nrm[0] * off, p[1] + (q[1] - p[1]) * t + nrm[1] * off];
  const plant = (c, w, d, h, ry) => B.box('plant', c[0], H + h / 2, c[1], w, h, d, ry);
  const nRy = Math.atan2(-0.913, 0.407), sRy = Math.atan2(0.437, 0.9);
  plant([-186, -630], 9, 6, 3.2, nRy); plant([-206, -566], 7, 10, 3.2, sRy); plant([-188, -538], 6, 6, 2.6, sRy);
  for (const [c, w, d, ry] of [[[-190, -624], 14, 5, nRy], [[-203, -580], 5, 16, sRy]]) {
    B.box('clere', c[0], H + 1.4, c[1], w, 2.8, d, ry, { top: false });
    B.box('frame', c[0], H + 2.85, c[1], w + 0.2, 0.12, d + 0.2, ry);
  }

  // ---------------------------------------------------------------- the glazed link
  const { Wn, Ws, En, Es, nE, nW } = AWB;
  const yAt = (p) => linkRoofY(p[0], p[1]);
  const boxW = (p) => { const a = AWB.axis; return [p[0] - a.d[0] * 0, p[1]]; };
  // split points where the glass box begins (t = BOX_T along each long side)
  const nB = lerp2(En, Wn, BOX_T), sB = lerp2(Es, Ws, BOX_T);
  // east face: ground-floor glazing + white fascia canopy
  const eDir = [Es[0] - En[0], Es[1] - En[1]], eL = Math.hypot(eDir[0], eDir[1]);
  {
    const k = signedArea([En, Es, Ws, Wn]) > 0;    // orientation of the face pair
    const [a, b] = (nE[0] * (eDir[1]) + nE[1] * -eDir[0]) > 0 ? [En, Es] : [Es, En];
    B.wall('glass', a[0], a[1], b[0], b[1], 0, LINK_LOW - 0.4, 2, 1.9);
    const fy = LINK_LOW - 0.4, c = lerp2(En, Es, 0.5), ry = Math.atan2(nE[0], nE[1]);
    B.box('white', c[0] + nE[0] * 0.6, fy + 0.45, c[1] + nE[1] * 0.6, eL + 1.2, 0.9, 1.6, ry);
    void k;
  }
  // glass roof: quad En, Es at LINK_LOW up to nB, sB at the box
  {
    const p = [[En[0], LINK_LOW + 0.05, En[1]], [Es[0], LINK_LOW + 0.05, Es[1]], [sB[0], LINK_HIGH - 0.6, sB[1]], [nB[0], LINK_HIGH - 0.6, nB[1]]];
    const L1 = Math.hypot(sB[0] - Es[0], sB[1] - Es[1]);
    const up = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return u[2] * v[0] - u[0] * v[2]; };
    const quadUp = up(p[0], p[1], p[2]) > 0 ? [p[0], p[1], p[2], p[3]] : [p[3], p[2], p[1], p[0]];
    B.quad('glassRoof', ...quadUp, [0, 0], [eL / 2, 0], [eL / 2, L1 / 1.9], [0, L1 / 1.9]);
    // mullion bars along the slope
    for (let i = 0; i <= 6; i++) { const t = i / 6; const a = lerp2(En, Es, t), b = lerp2(nB, sB, t); B.bar('frame', [a[0], LINK_LOW + 0.1, a[1]], [b[0], LINK_HIGH - 0.55, b[1]], 0.12); }
  }
  // the common-room box: cantilevered 1.5 m beyond the west face, glass on three sides, white frame bands
  {
    const o = 1.5, wn = [Wn[0] + nW[0] * o, Wn[1] + nW[1] * o], ws = [Ws[0] + nW[0] * o, Ws[1] + nW[1] * o];
    const y0 = LINK_LOW, y1 = LINK_HIGH;
    const ring = ccw([nB, sB, ws, wn]);
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[(i + 1) % 4];
      const shared = (a === nB && b === sB) || (a === sB && b === nB);
      if (shared) continue;
      B.wall('glass', a[0], a[1], b[0], b[1], y0 + 0.5, y1 - 0.4, 3, (y1 - y0 - 0.9) / 2);
    }
    // white frame: bottom band, top band, soffit and roof
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L, ry = Math.atan2(dz, -dx);
      const c = lerp2(a, b, 0.5);
      B.box('white', c[0], y0 + 0.25, c[1], L + 0.2, 0.5, 0.2, ry);
      B.box('white', c[0], y1 - 0.2, c[1], L + 0.2, 0.4, 0.2, ry);
      // vertical mullions every ~3 m on the glazed faces
      const nm = Math.max(1, Math.round(L / 3));
      for (let j = 1; j < nm; j++) { const q = lerp2(a, b, j / nm); B.box('frame', q[0], (y0 + y1) / 2, q[1], 0.1, y1 - y0 - 0.9, 0.12, ry); }
    }
    B.flat('white', ring, y1, false, 2);
    B.flat('white', ring, y0, true, 2);
    // ground floor under the box: recessed glazing with the revolving door
    const [a, b] = [Wn, Ws];
    const wl = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const aa = (nW[0] * (b[1] - a[1]) - nW[1] * (b[0] - a[0])) > 0 ? [a, b] : [b, a];
    B.wall('glass', aa[0][0], aa[0][1], aa[1][0], aa[1][1], 0, y0, 2, 1.9);
    const c = lerp2(Wn, Ws, 0.5);
    B.box('frame', c[0] + nW[0] * 0.9, 1.25, c[1] + nW[1] * 0.9, 2.6, 2.5, 0.1, Math.atan2(nW[0], nW[1]));   // revolving-door drum (simplified)
    B.box('frame', c[0] + nW[0] * 0.9, 2.55, c[1] + nW[1] * 0.9, 2.8, 0.12, 2.0, Math.atan2(nW[0], nW[1]));
    void wl; void boxW;
  }
  col.addPolygon(AWB.link);

  // sign by the forecourt (guess: plain University blue totem)
  {
    const p = [-165.8, -602.5], ry = Math.atan2(AWB.nE[0], AWB.nE[1]);
    B.box('frame', p[0], 1.1, p[1], 1.0, 2.2, 0.16, ry);
    const c = Math.cos(ry), s = Math.sin(ry), hw = 0.48;
    const P = (lx, y, lz) => [p[0] + lx * c + lz * s, y, p[1] - lx * s + lz * c];
    B.quad('sign', P(-hw, 1.2, 0.085), P(hw, 1.2, 0.085), P(hw, 2.15, 0.085), P(-hw, 2.15, 0.085), [0, 0], [1, 0], [1, 1], [0, 1]);
    col.addCircle(p[0], p[1], 0.5);
  }

  // ---------------------------------------------------------------- Penrose forecourt
  const pv = AWB.paving, bb = { minX: Math.min(...pv.map((p) => p[0])), maxX: Math.max(...pv.map((p) => p[0])), minZ: Math.min(...pv.map((p) => p[1])), maxZ: Math.max(...pv.map((p) => p[1])) };
  const PAV = pavingTexture(bb, 0.9);
  const pavMat = world.layerMaterial(new THREE.MeshStandardMaterial({ map: PAV.texture, roughness: 0.55, metalness: 0.05 }), 'marking');
  const P = new Batch();
  P.flat('pav', pv, world.Y.marking + 0.004, false, 1);
  // remap uvs into the texture square
  const pm = P.build({ pav: pavMat })[0];
  const uv = pm.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - bb.minX) / PAV.size, 1 - (uv.getY(i) - bb.minZ) / PAV.size);
  uv.needsUpdate = true;
  pm.receiveShadow = true;
  world.clearArea(pv, { lamps: false });

  const group = new THREE.Group(); group.name = 'andrew-wiles-building';
  const meshes = B.build(mats, group, { shadows: true, noCast: ['glassRoof', 'sign'] });
  group.add(pm);
  world.addStatic(group);
  return { group, meshes, tris: B.tris() + P.tris(), drawCalls: meshes.length + 1, paving: PAV, mats };
}
