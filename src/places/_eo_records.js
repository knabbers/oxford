// Truck Store ("Slow Spin Records" under ?invented=1), a record shop on the Cowley Road you can walk into — owned by places/cowley_road.js.
// One room: racks of crates down the middle, shelves of sleeves on the walls, the counter with a turntable, a listening
// post. [E] flick through a crate (an invented record, comic), [E] buy it (£8, a little synthesised riff plays), and the
// shop's own small joke: the person behind the counter recommends something you have never heard of. Everything invented.
import * as THREE from 'three';
import { kitGaps, glazing, cityDoor, mergeRoom, reveal } from './_walkin_city.js';
import { tn } from '../core/features.js';

export const RECORDS = [
  ['The Low Tides', 'Iffley Lock at Dawn', 'post-rock, four tracks, forty minutes'],
  ['Jericho Brass Collective', 'Canal Street Stomp', 'brass band funk'],
  ['Marmalade Static', 'Bus Lane Lullabies', 'lo-fi bedroom pop'],
  ['DJ Kettle', 'Two Sugars', 'twelve-inch house, white label'],
  ['The Cowley Ramblers', 'Live at the Ballroom', 'skiffle, recorded badly'],
  ['Hinksey Drift', 'Flood Meadow', 'ambient, mostly rain'],
  ['Sister Sledgehammer', 'Pothole Symphony', 'garage punk'],
  ['The Plain Truth', 'Roundabout', 'mod revival, very loud'],
  ['Annie & the Allotments', 'Runner Beans', 'folk, with a cello'],
  ['Mild Peril', 'Dreaming Spires (Remix)', 'drum and bass'],
];
export const CLERK = ['If you like that, you will hate this one. In a good way.', 'They played in a launderette once. Legendary.', 'Only three copies were pressed. This is two of them.', 'Honestly? Put it on at half speed.'];
export const PRICE = 8;
/** the riff a record plays: a few notes from its index (pure) */
export function riff(i) { const base = [220, 247, 262, 294, 330, 349, 392][i % 7]; return [0, 3, 5, 7, 5, 3, 0, -2].map((s, k) => ({ f: base * Math.pow(2, ((s + (k === 7 ? i % 3 : 0)) / 12)), t: k * 0.16 })); }

// Walk-in (core/interiors.js "seamless"; _walkin_city.js): the shop in place inside its mapped building (7.3 m wide,
// 17.6 deep): the room is 6.0 × 13 m behind a real shopfront — a glazed door between two display windows.
export const REC = { w: 6.0, d: 13, t: 0.2, doorW: 1.4, doorH: 2.4 };
// (the doorway is moved onto the facade's painted shop door — a recessed lobby — and the painted shopfront glass beside
//  it is the window: _walkin_city.js facadeBays; only the street wall has windows)
export const recPlanSpec = () => ({ portal: { at: [0, REC.d / 2 + REC.t / 2], out: 0, w: REC.doorW, h: REC.doorH, snapBay: 2.2 }, rects: [[-REC.w / 2, -REC.d / 2, REC.w / 2, REC.d / 2]], wall: 0.3,
  auto: { walls: [{ a: [REC.w / 2, REC.d / 2], b: [-REC.w / 2, REC.d / 2], out: 0 }], maxDepth: 1.6, maxY: 3.0 } });
export function buildRecords(ctx, game, plan = null) {
  const W = game.world, K = W.interiorKit, s = ctx.scene, col = ctx.collider, M = W.mats;
  const SL = !!(ctx.seamless && plan);
  const w = SL ? REC.w : 6.4, d = 13;
  K.room(s, { w, d, h: 3.3, floor: 'wood', walls: 'plaster', collider: col, doors: SL ? kitGaps(plan) : [{ wall: 's', at: 0, width: 1.4, height: 2.4 }] });
  const sleeveMats = new Map(), sleeveMat = (c) => { let m = sleeveMats.get(c); if (!m) sleeveMats.set(c, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }))); return m; };
  // the crates: three rows of browsers down the middle
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.8 });
  const sleeveCols = [0xd23a2a, 0x2a5aa8, 0xf2c23a, 0x1a1a1a, 0xe8e0d0, 0x3a8a4a, 0x8a3a8a, 0xe87a2a];
  const g = new THREE.Group();
  for (let r = 0; r < 3; r++) for (let side = -1; side <= 1; side += 2) {
    const x = side * 1.2, z = -3.6 + r * 2.4;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 1.9), crateMat); crate.position.set(x, 0.425, z); g.add(crate);
    col.addBox(x, z, 0.9, 1.9, 0);
    for (let k = 0; k < 14; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.012), sleeveMat(sleeveCols[(k + r * 3 + (side > 0 ? 1 : 0)) % sleeveCols.length])); m.position.set(x, 0.98, z - 0.85 + k * 0.125); m.rotation.x = -0.3; g.add(m); }
  }
  s.add(g);
  // wall shelves of sleeves (the books material reads as rows of spines), posters
  K.shelf(s, { x: -w / 2 + 0.25, z: -2, rot: Math.PI / 2 }); K.shelf(s, { x: -w / 2 + 0.25, z: 1.5, rot: Math.PI / 2 }); K.shelf(s, { x: w / 2 - 0.25, z: -2, rot: -Math.PI / 2 }); K.shelf(s, { x: w / 2 - 0.25, z: 1.5, rot: -Math.PI / 2 });
  for (const [x, z, ry] of [[-w / 2 + 0.02, -4.6, Math.PI / 2], [w / 2 - 0.02, -4.6, -Math.PI / 2], [-w / 2 + 0.02, 4.0, Math.PI / 2]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.25), new THREE.MeshStandardMaterial({ color: sleeveCols[Math.round(x + z) & 7], roughness: 0.7 })); p.position.set(x, 1.9, z); p.rotation.y = ry; s.add(p); }
  // the counter at the back with a turntable, and the listening post
  K.barCounter(s, { x: 0, z: -d / 2 + 1.4, w: 3.4, collider: col });
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })); deck.position.set(0.8, 1.13, -d / 2 + 1.4); s.add(deck);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x2a2a2a })); post.position.set(w / 2 - 0.6, 0.6, 4.2); s.add(post); col.addBox(w / 2 - 0.6, 4.2, 0.5, 0.4, 0);
  K.warmLight(s, { x: 0, y: 3.0, z: -2, intensity: 5, distance: 11 }); K.warmLight(s, { x: 0, y: 3.0, z: 3.5, intensity: 4, distance: 9 });
  void M;
  if (SL) {
    // the window display: sleeves standing on the bed of each shop window (the window is a deep bay: the glass at the
    // street face, its bed at sill height running back to the room), faces to the street; a card of the week's picks
    for (const o of plan.seamless.openings) {
      if (Math.abs(o.out) > 0.1 || o.w < 1.2) continue;
      const pw = o.w - 0.3, dz = Math.max(0.25, (o.depth || 0.3) * 0.6), y = (o.y0 || 0.5) + 0.004, n = Math.max(2, Math.floor(pw / 0.42));
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.31, 0.012), sleeveMat(sleeveCols[(k * 3 + 1) % sleeveCols.length]));
        m.position.set(o.at[0] - pw / 2 + (k + 0.5) * (pw / n), y + 0.15, o.at[1] + dz - (k % 2) * 0.12); m.rotation.x = -0.2; s.add(m);
      }
      // a second, lower row nearer the room, seen over from inside
      for (let k = 0; k < n - 1; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.31, 0.012), sleeveMat(sleeveCols[(k * 5 + 2) % sleeveCols.length])); m.position.set(o.at[0] - pw / 2 + (k + 1) * (pw / n), y + 0.02, o.at[1] + dz * 0.45); m.rotation.x = -1.35; s.add(m); }
    }
    s.add(glazing(plan.seamless.openings, { inset: 0.96 })); s.add(reveal(plan.seamless.portals, { floor: true })); cityDoor(ctx, plan, { style: 'glass', hinge: -1, open: plan.hours && plan.hours.open }); mergeRoom(s);
  }
  const px = SL ? plan.seamless.portals[0].at[0] : 0;
  ctx.addExit(0, d / 2 - 0.6, 'Leave ' + tn('Truck Store', 'Slow Spin Records'));
  return { spawn: [px, d / 2 - 1.4], heading: Math.PI, crates: [[-1.2, -1.2], [1.2, 1.2]], counter: [0, -d / 2 + 2.6], post: [w / 2 - 0.6, 3.5], clerk: [0, -d / 2 + 0.7] };
}
