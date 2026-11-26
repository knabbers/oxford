// The Randolph Hotel, Beaumont Street — "on fire half the time".
// Exterior rebuilt over OSM w130731852 (_randolph_build.js). The fire follows the shared clock (_randolph_fire.js):
// it burns during one 6-real-minute slot in every CYCLE (8: every 48 real minutes; it was every other slot, which put
// its smoke column in most views of the west of the city) — smoke from the kitchen extract duct at
// the back, flames climbing the duct, roof + central tower ablaze, dying down — then a minute of charred roof,
// scaffolding and tarpaulin before it reopens pristine. Based on the real fire of Friday 17 April 2015 (flambéed beef
// stroganoff in the ground-floor kitchen; fire up an external vent to the roof; the central tower's peak destroyed;
// nobody hurt). Emergency response, a bucket-chain mini-task, and an enterable lobby + Morse Bar when it isn't burning.
// Test hooks: game.randolph.{force('burn'|'calm'|<phase>|null), phase, state, view(...), stats(), bucket, lobby()}.
// URL: ?randolph=burn|calm|smoke|climb|blaze|dying|aftermath
import * as THREE from 'three';
import { randomLook } from '../core/characters.js';
import { Geo, paintMaterial } from './_randolph_kit.js';
import { fireState, bucketStep, BUCKET } from './_randolph_fire.js';
import { createFlames, createSmoke, createEmbers, createSpray, FireAudio } from './_randolph_fx.js';
import { buildHotel, fireEngine, tape, L2W, L2W3, headingL, H, TOWER, DOOR, DUCT } from './_randolph_build.js';
import { planWalkin, streetDoor, cityDoor, warmLater, glazing, dressOpenings, archLining, roomCrowd } from './_walkin_city.js';
import { buildLobby, LOBBY, LOBBY_WIN } from './_randolph_lobby.js';

const ID = 'randolph', LOBBY_ID = 'randolph_lobby';
const FAR = 300, NPC_R = 160;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const LINES = {
  ff: ['Not again.', 'Third time this week.', 'Stand well back, please.', "We've got our own parking space here now.", "Somebody's flambéed something again."],
  police: ['Behind the tape, please.', 'Nothing to see here. Well — quite a lot to see, actually.', 'Every Friday, this.', "Nobody's hurt. Just the roof."],
  chef: ['It was meant to be a flambé.', 'Beef stroganoff. Cognac. Bit too much cognac.', 'In my defence, it looked amazing for about four seconds.', 'The extractor fan has a lot to answer for.'],
  guest: ['I was in the bath.', 'Is this included in the room rate?', 'We only came for the afternoon tea.', 'Every time we stay here.', 'At least they let us keep the dressing gowns.'],
  look: ['Is the Randolph on fire again?', 'Getting this on Facebook.', "Morse would've solved this by now.", 'Same time next week, then.'],
};
// scripted people (local coords, local heading)
const CAST = [
  { key: 'ff1', role: 'ff', at: [13.0, -2.9], h: Math.atan2(1.5, 8.9), when: 'response', name: 'Firefighter' },
  { key: 'ff2', role: 'ff', at: [27.2, -3.0], h: Math.atan2(-2.7, 8.0), when: 'response', name: 'Firefighter' },
  { key: 'police', role: 'police', at: [-0.6, -2.6], h: -Math.PI / 2, when: 'response', name: 'Police officer' },
  { key: 'guest1', role: 'guest', at: [-3.0, -1.4], h: Math.PI / 2 + 0.2, when: 'evacuated', name: 'Hotel guest' },
  { key: 'guest2', role: 'guest', at: [-4.3, -3.4], h: Math.PI / 2 - 0.1, when: 'evacuated', name: 'Hotel guest' },
  { key: 'chef', role: 'chef', at: [-2.2, -4.3], h: Math.PI / 2 + 0.6, when: 'evacuated', name: 'Chef' },
  { key: 'look1', role: 'look', at: [-6.8, -2.0], h: Math.PI / 2 + 0.35, when: 'evacuated', name: 'Onlooker' },
  { key: 'look2', role: 'look', at: [-8.0, -3.9], h: Math.PI / 2 + 0.45, when: 'evacuated', name: 'Onlooker' },
];
const AIM = { ff1: [14.5, 17.5, 6], ff2: [24.5, 18.5, 5] };
const STANDPIPE = [5.5, -4.5];

function lookFor(c) {
  if (c.role === 'ff') return randomLook('randolph-' + c.key, { outfit: 'firefighter' });
  if (c.role === 'police') return randomLook('randolph-police', { outfit: 'police' });
  if (c.role === 'chef') return randomLook('randolph-chef', { outfit: 'chef' });
  if (c.role === 'look') return randomLook('randolph-' + c.key, { outfit: 'casual', prop: 'phone' });
  // dressing gown + slippers
  const L = randomLook('randolph-' + c.key, { outfit: 'casual' });
  return { ...L, jacket: 0xf4f1ea, jacketLen: 'long', shirt: 0xf4f1ea, top: 0xf4f1ea, bottom: 0xe2ddd2, shoes: 0xf2f2f2, shoeStyle: 'shoe', hat: null, scarf: null, backpack: null, gown: null, prop: c.key === 'guest2' ? 'coffee' : null };
}

export default {
  id: ID,
  preMap(game) {
    game.overrides.skip.add('w130731852');            // the Randolph: rebuilt by hand
  },

  install(game) {
    const world = game.world, U = world.uniforms, scene = game.worldScene;
    const t0 = performance.now();
    const hotel = buildHotel(game);
    const R = (game.randolph = { id: ID, forced: null, state: null, hotel });
    const q = new URLSearchParams(location.search).get('randolph');
    if (q) R.forced = q === 'null' ? null : q;
    const audio = new FireAudio(game);
    const CENTRE = L2W(20, 10);
    const st = fireState(game.time.now(), R.forced);
    R.state = st;

    // ------------------------------------------------------------------------------------- fire effects
    const F = [];
    for (let i = 0; i < 6; i++) F.push({ p: [DUCT.x, 8.3 + i * 1.55, DUCT.z + 0.95], w: 1.4, h: 2.4, start: 0.08 + (0.32 * i) / 5 });
    F.push({ p: [13.4, 17.2, 12.0], w: 2.6, h: 3.4, start: 0.42 }, { p: [15.9, 17.6, 11.6], w: 2.6, h: 3.6, start: 0.44 }, { p: [14.6, 18.8, 9.6], w: 3.0, h: 4.2, start: 0.46 });
    for (let x = 11.5; x <= 28.6; x += 1.9) F.push({ p: [x, 19.4, 6.9], w: 4.6, h: 8.5, start: 0.47 + (0.3 * Math.abs(x - DUCT.x)) / 14 });
    for (let x = 12.0; x <= 28.2; x += 2.7) if (Math.abs(x - 20.05) > 2.4) F.push({ p: [x, 18.4, 1.6], w: 3.0, h: 4.5, start: 0.55 + (0.3 * Math.abs(x - DUCT.x)) / 14 });
    for (const x of [12.41, 16.23, 23.87, 27.69]) F.push({ p: [x, 16.0, 0.2], w: 1.6, h: 2.8, start: 0.58 + (0.2 * Math.abs(x - DUCT.x)) / 13 });
    for (const [x, z] of [[TOWER.x0 + 0.3, TOWER.z0 + 0.3], [TOWER.x1 - 0.3, TOWER.z0 + 0.3], [TOWER.x0 + 0.3, TOWER.z1 - 0.3], [TOWER.x1 - 0.3, TOWER.z1 - 0.3]]) F.push({ p: [x, 20.9, z], w: 2.0, h: 3.4, start: 0.72 });
    F.push({ p: [20.05, 22.8, 2.27], w: 3.6, h: 6.5, start: 0.78 }, { p: [20.05, 25.4, 2.27], w: 2.6, h: 5.2, start: 0.84 });
    for (const [x, s] of [[16.23, 0.86], [23.87, 0.9], [12.41, 0.93]]) F.push({ p: [x, 12.35, 0.3], w: 1.2, h: 2.6, start: s });
    F.push({ p: [9.6, 19.6, 6.5], w: 2.8, h: 4.4, start: 0.9 }, { p: [30.3, 19.6, 5.0], w: 2.8, h: 4.0, start: 0.95 });
    const flames = createFlames(F.map((f) => ({ ...f, p: L2W3(f.p) })), U.time, { wind: [0.22, -0.14] });
    const smoke = createSmoke(72, U.time, U.night, { wind: [0.2, -0.13], size: [3.5, 55], radial: 3 });
    const embers = createEmbers(140, U.time, L2W3([20, 20.5, 7]), 9, 6, { wind: [0.22, -0.14] });
    const sprayJets = [];
    const castW = {};                                   // world positions of the cast posts
    for (const c of CAST) { const w = L2W(c.at[0], c.at[1]); castW[c.key] = { x: w[0], z: w[1], h: headingL(c.h) }; }
    for (const k of ['ff1', 'ff2']) {
      const c = castW[k], f = [Math.sin(c.h), Math.cos(c.h)];
      sprayJets.push({ from: [c.x + f[0] * 0.75, 1.3, c.z + f[1] * 0.75], to: L2W3(AIM[k]), arc: 7 });
    }
    const spray = createSpray(sprayJets, U.time, 160);
    for (const o of [flames, smoke, embers, spray]) { o.mesh.visible = false; scene.add(o.mesh); }
    const light = new THREE.PointLight(0xff7a2a, 0, 90, 1.6);
    light.position.set(...L2W3([20, 19, -4.5])); light.castShadow = false; scene.add(light);
    const smokeA = new THREE.Vector3(...L2W3([DUCT.x, DUCT.y1 + 0.4, DUCT.z + 0.4])), smokeB = new THREE.Vector3(...L2W3([19.5, 21, 6.5]));

    // ------------------------------------------------------------------------------------- engines, tape, standpipe
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1a2a80, emissive: 0x2a5aff, emissiveIntensity: 0, roughness: 0.3 });
    const RG = new Geo(); RG.push(new THREE.Matrix4().makeRotationY(0.2593).setPosition(3.6, 0, -3.8));
    const ENG = [[8.0, -5.3], [32.0, -5.3]];
    for (const [x, z] of ENG) fireEngine(RG, x, z, -Math.PI / 2);
    tape(RG, [0.6, -0.15], [0.6, -5.0]); tape(RG, [39.6, -0.15], [39.6, -5.0]);
    RG.color(0x8a2a1a);
    RG.beam('paint', [8.8, 0.2, -4.05], [10.8, 0.17, -3.6], 0.09); RG.beam('paint', [10.8, 0.17, -3.6], [12.6, 0.2, -3.1], 0.09);
    RG.beam('paint', [31.2, 0.2, -4.05], [29.4, 0.17, -3.7], 0.09); RG.beam('paint', [29.4, 0.17, -3.7], [27.6, 0.2, -3.2], 0.09);
    // standpipe on the hydrant + the yellow "H" plate, and a stack of buckets (UK hydrants are under the pavement)
    RG.color(0xb8bcc0); RG.cyl('paint', STANDPIPE[0], 0.13, STANDPIPE[1], 0.06, 0.95, 8); RG.beam('paint', [STANDPIPE[0], 0.9, STANDPIPE[1]], [STANDPIPE[0] + 0.35, 0.9, STANDPIPE[1]], 0.06);
    RG.color(0x2a2a2a); RG.box('paint', STANDPIPE[0] - 0.25, 0.13, STANDPIPE[1] - 0.2, STANDPIPE[0] + 0.25, 0.16, STANDPIPE[1] + 0.2);
    RG.color(0x3a3a3a); RG.cyl('paint', 4.3, 0, -0.25, 0.04, 1.0, 6); RG.color(0xf2d21a); RG.box('paint', 4.12, 0.85, -0.33, 4.48, 1.2, -0.29);
    RG.color(0x1a1a1a); RG.box('paint', 4.28, 0.88, -0.34, 4.32, 1.17, -0.33); RG.box('paint', 4.18, 1.0, -0.34, 4.42, 1.04, -0.33);
    RG.color(0xd02020); for (let i = 0; i < 3; i++) RG.cyl('paint', 6.3 + (i % 2) * 0.05, 0.13 + i * 0.12, -4.3, 0.17, 0.3, 9, 0.21);
    RG.pop();
    const respGroup = new THREE.Group(); respGroup.name = 'randolph:response'; respGroup.visible = false;
    const respMeshes = RG.build({ paint: paintMaterial(), blue: blueMat }, respGroup, { name: 'randolph-response' });
    world.addStatic(respGroup);
    const engCol = [];
    for (const [x, z] of ENG) { const w = L2W(x, z); for (const s of game.worldCollider.addBox(w[0], w[1], 2.45, 8.5, headingL(-Math.PI / 2))) { s.on = false; engCol.push(s); } }

    // ------------------------------------------------------------------------------------- aftermath: scaffold + tarp
    const SG = new Geo(); SG.push(new THREE.Matrix4().makeRotationY(0.2593).setPosition(3.6, 0, -3.8));
    const scafCol = [];
    {
      const xs = []; for (let x = 11.0; x <= 29.2; x += 2.3) xs.push(x);
      const zs = [-1.75, -0.45], top = 20.5;
      SG.color(0x9ea4a8);
      for (const x of xs) for (const z of zs) { SG.beam('paint', [x, 0, z], [x, top, z], 0.05); scafCol.push([x, z]); }
      for (let y = 2.0; y <= top; y += 2.0) {
        for (const z of zs) SG.beam('paint', [xs[0], y, z], [xs[xs.length - 1], y, z], 0.05);
        for (const x of xs) SG.beam('paint', [x, y, zs[0]], [x, y, zs[1]], 0.05);
        SG.color(0x8a6a3a); SG.box('paint', xs[0], y + 0.03, zs[0] + 0.05, xs[xs.length - 1], y + 0.08, zs[1] - 0.05); SG.color(0x9ea4a8);
      }
      for (let i = 0; i < xs.length - 1; i += 2) SG.beam('paint', [xs[i], 0.2, zs[0]], [xs[i + 1], top - 0.5, zs[0]], 0.045);
      // blue tarpaulins over the burnt mansard and the tower stump
      SG.color(0x2a5ab8);
      SG.poly('paint', [[11.2, 15.4, 0.15], [29.0, 15.4, 0.15], [29.0, 19.2, 1.5], [11.2, 19.2, 1.5]], [0, 0.3, -1]);
      SG.poly('paint', [[11.2, 19.2, 1.5], [29.0, 19.2, 1.5], [29.0, 20.0, 6.9], [11.2, 20.0, 6.9]], [0, 1, -0.1]);
      SG.color(0x3366c4); SG.hipRoof('paint', TOWER.x0 - 0.4, TOWER.z0 - 0.4, TOWER.x1 + 0.4, TOWER.z1 + 0.4, H.towerTop + 0.4, H.peakBase + 0.4, 1.0, 1.0);
      // charred rafters sticking up from the tower stump
      SG.color(0x161210);
      for (const [x, z] of [[18.9, 1.2], [21.2, 1.3], [19.3, 3.4], [20.9, 3.3]]) SG.beam('paint', [x, H.peakBase, z], [20.05 + (x - 20.05) * 0.4, H.peakBase + 1.8, 2.27 + (z - 2.27) * 0.4], 0.14);
    }
    SG.pop();
    const scafGroup = new THREE.Group(); scafGroup.name = 'randolph:scaffold'; scafGroup.visible = false;
    SG.build({ paint: paintMaterial() }, scafGroup, { name: 'randolph-scaffold' });
    world.addStatic(scafGroup);
    const scafShapes = scafCol.map(([x, z]) => { const w = L2W(x, z); const s = game.worldCollider.addCircle(w[0], w[1], 0.08, { tag: 'scaffold' }); s.on = false; return s; });

    // ------------------------------------------------------------------------------------- people
    const cast = new Map();      // key -> {ped, c, pos:Vector3, li}
    const talkHandles = [];
    const FARV = new THREE.Vector3(1e6, 0, 1e6);
    const nozzleMat = paintMaterial();
    function spawnCast(c) {
      if (!game.pedestrians || cast.has(c.key)) return;
      const w = castW[c.key];
      const pose = c.role === 'ff' ? 'lean' : c.role === 'look' ? 'photo' : c.role === 'police' ? 'stand' : c.role === 'chef' ? 'talk' : 'stand';
      let ped = null;
      try { ped = game.pedestrians.spawnAt(w.x, w.z, lookFor(c), { heading: w.h, pose, knockable: c.role !== 'ff', lines: LINES[c.role], role: 'randolph-' + c.role, label: c.role === 'chef' ? 'Chef' : null }); }
      catch (e) { console.error('[randolph] spawn', e); return; }
      if (c.role === 'ff' && ped.character.anchors) {
        const n = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 7), nozzleMat);
        n.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n.geometry.attributes.position.count * 3).fill(0.3), 3));
        n.rotation.x = Math.PI / 2; n.position.set(0, -0.02, 0.12); ped.character.anchors.handR.add(n);
      }
      cast.set(c.key, { ped, c, pos: new THREE.Vector3(w.x, 0, w.z), li: 0 });
    }
    function despawnCast(key) { const e = cast.get(key); if (!e) return; try { game.pedestrians.remove(e.ped); } catch { /* */ } cast.delete(key); }
    for (const c of CAST) {
      talkHandles.push(game.interact.add({
        pos: () => { const e = cast.get(c.key); if (e) e.pos.set(e.ped.x, 0, e.ped.z); return e ? e.pos : FARV; },
        radius: 1.7, label: `Talk to the ${c.name.toLowerCase()}`, enabled: () => cast.has(c.key),
        onUse: () => { const e = cast.get(c.key); if (!e) return; const L = LINES[c.role]; const line = L[e.li++ % L.length]; e.ped.character.say?.(line, 3); game.ui.dialog(c.name, [line]); },
      }));
    }
    function syncCast(near) {
      for (const c of CAST) {
        const want = near && (c.when === 'response' ? st.response : st.evacuated);
        if (want && !cast.has(c.key)) spawnCast(c);
        else if (!want && cast.has(c.key)) despawnCast(c.key);
      }
    }

    // ------------------------------------------------------------------------------------- bucket chain
    const task = { carrying: false, trips: 0, done: false, slot: -1 };
    let bucketMesh = null;
    const bucketGeo = (() => {
      const B = new Geo(); B.color(0xd02020); B.cyl('paint', 0, -0.3, 0, 0.13, 0.28, 10, 0.16); B.color(0x3a7ad8); B.cyl('paint', 0, -0.06, 0, 0.145, 0.02, 10, 0.145);
      B.color(0x888888); B.beam('paint', [-0.15, -0.02, 0], [0, 0.05, 0], 0.012); B.beam('paint', [0.15, -0.02, 0], [0, 0.05, 0], 0.012);
      return B.build({ paint: paintMaterial() }, null, { name: 'bucket', cast: false }).paint;
    })();
    function holdBucket(on) {
      if (bucketMesh && bucketMesh.parent) bucketMesh.parent.remove(bucketMesh);
      bucketMesh = null;
      if (on) { bucketMesh = bucketGeo.clone(); bucketMesh.matrixAutoUpdate = true; game.player.character.anchors.handR.add(bucketMesh); }
      if (NA) NA.set('bucket', on ? 1 : null);
    }
    // (the bucket in another player's hand: core/_mp_actions.js)
    const NA = game.net && game.net.actions ? game.net.actions : null;
    if (NA) NA.kind('bucket', {
      apply(o) { this.remove(o); const m = bucketGeo.clone(); m.matrixAutoUpdate = true; o.character.anchors.handR.add(m); o._randBucket = m; },
      remove(o) { if (o._randBucket) { o._randBucket.removeFromParent(); o._randBucket = null; } },
    });
    function bucket(ev) {
      if (task.slot !== st.slot) { task.slot = st.slot; task.trips = 0; task.done = false; task.carrying = false; }
      const r = bucketStep(task, ev);
      if (r === 'grabbed') { holdBucket(true); game.ui.objective(`Bucket chain: carry the water to the hotel door (${task.trips + 1}/${BUCKET.trips})`); game.ui.toast('You fill a bucket from the standpipe.', 2.5); }
      else if (r === 'thrown' || r === 'reward') {
        holdBucket(false); audio.splash();
        if (r === 'thrown') { game.ui.toast('Splosh. A firefighter nods politely.', 2.5); game.ui.objective(`Bucket chain: back to the standpipe for another (${task.trips}/${BUCKET.trips})`); }
        else {
          game.ui.objective(null); game.pay(BUCKET.reward); audio.coin();
          game.state.flags.randolphBuckets = (game.state.flags.randolphBuckets || 0) + 1; game.save();
          game.ui.dialog('Duty manager', ['Thank you so much. Here — £5, for your trouble.', "We'll have it open again in a minute. We always do."]);
        }
      } else if (r === 'stopped') { holdBucket(false); game.ui.objective(null); }
      return r;
    }
    game.interact.add({ pos: L2W(STANDPIPE[0], STANDPIPE[1] + 0.3), radius: 1.6, label: 'Grab a bucket', enabled: () => st.hosing && !task.carrying && !(task.done && task.slot === st.slot), onUse: () => bucket('grab') });

    // ------------------------------------------------------------------------------------- the door + lobby interior
    const doorW = L2W(DOOR[0], DOOR[1]);
    const doorObj = { pos: [doorW[0], doorW[1]], facing: headingL(Math.PI) };
    // Walk-in (core/interiors.js "seamless"; _walkin_city.js): the lobby and the Morse Bar are in place behind the
    // entrance tower (lobby 12 × 10 m from 0.8 m inside the tower's face, the bar behind it: 17.4 m of the hotel's 27 m
    // depth). The street door is a pair of oak leaves that open as you walk at them; while the hotel is on fire or
    // charred they are locked, with the "Closed" card on them. Only the doorway is an opening: the lobby's front
    // windows are still the painted facade's.
    let plan = null;
    try {
      const foot = [[0, 0], [10.5, 0], [10.5, 0.6], [TOWER.x0, 0.6], [TOWER.x0, TOWER.z0], [TOWER.x1, TOWER.z0], [TOWER.x1, 0.6], [29.6, 0.6], [29.6, 0],
        [40.1, 0], [40.1, 10.5], [39.5, 10.5], [39.5, 21], [40.1, 21], [40.1, 27.2], [27, 27.2], [27, 28.0], [23.3, 27.8], [3.7, 30.4], [0, 31]].map(([x, z]) => L2W(x, z));      // (as _randolph_build.js's collider)
      plan = planWalkin(game, { id: LOBBY_ID, building: foot, door: doorObj, portal: { at: [0, -5], out: Math.PI, w: 1.8, h: 2.6 }, wall: 0.55,
        rects: [[-6, -5, 6, 5], [-5, 5.2, 5, 12.2]], center: [0, 2], mid: [0, 3.4],
        // the two pointed windows either side of the tower: real openings exactly on the facade's painted ones
        windows: LOBBY_WIN.xs.map((x) => ({ at: [x, -5], out: Math.PI, w: LOBBY_WIN.w, y0: LOBBY_WIN.y0, y1: LOBBY_WIN.y1 })) });
      if (plan) streetDoor(game, plan, { every: 50, dwell: [20, 60] });      // (guests in and out of the lobby)
    } catch (e) { console.error('[randolph] plan', e); }
    const slOn = () => { const d = game.interiors.get(LOBBY_ID); return !!(d && d.sl); };
    game.interact.add({
      enabled: () => !slOn() || !!task.carrying,
      pos: L2W(DOOR[0], DOOR[1] - 0.2), radius: 1.9,
      label: () => (task.carrying ? 'Chuck the water on' : st.open ? 'Enter The Randolph' : 'The Randolph (closed)'),
      onUse: () => {
        if (task.carrying) { bucket('throw'); return; }
        if (st.open) { game.interiors.enter(LOBBY_ID, doorObj); return; }
        game.ui.toast(st.charred ? 'A sign on the door: "Closed for redecoration. Again."' : "A firefighter: \"Not a chance, mate. It's on fire.\"", 3.5);
      },
    });
    const lobbyPeds = [];
    let alarmT = 0;
    const DRINKS = [
      { label: 'A pint of real ale', price: 5.2, drunk: 0.12, msg: "£5.20. It's the Randolph, sir." },
      { label: 'A large gin and tonic', price: 9.5, drunk: 0.18, msg: 'Ice and a slice.' },
      { label: 'Afternoon tea for one', price: 28.5, energy: 60, msg: 'Scones, clotted cream, tiny sandwiches. You feel restored.' },
      { label: 'A glass of tap water', price: 0, drunk: -0.05, msg: "On the house. For now." },
    ];
    function barMenu() {
      game.beginActivity({ name: 'randolph-bar', pointer: 'free' });
      const o = game.ui.openOverlay(), box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#16120d;border:2px solid #b8963a;border-radius:8px;padding:18px 22px;color:#f4ecd8;font-family:Georgia,serif;min-width:340px';
      box.innerHTML = `<div style="font-size:22px;color:#d8b65a;font-weight:bold">The Morse Bar</div><div style="opacity:.7;margin-bottom:8px">You have £${game.state.money.toFixed(2)}</div>`;
      for (const d of DRINKS) {
        const b = document.createElement('button');
        b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0;padding:8px 10px;background:#241c12;color:#f4ecd8;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font:inherit';
        b.innerHTML = `${d.label} — <b>${d.price ? '£' + d.price.toFixed(2) : 'free'}</b>`;
        b.onclick = () => { game.endActivity(); R.order(d); };
        box.appendChild(b);
      }
      const nb = document.createElement('button'); nb.textContent = 'Nothing, thanks'; nb.style.cssText = 'margin-top:6px;padding:6px 10px;background:none;color:#c8b890;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font:inherit';
      nb.onclick = () => game.endActivity(); box.appendChild(nb);
      o.appendChild(box);
    }
    R.order = (d) => {
      if (typeof d === 'number') d = DRINKS[d];
      if (!game.pay(-d.price)) { game.ui.toast(`That's £${d.price.toFixed(2)}. You have £${game.state.money.toFixed(2)}.`, 3); return false; }
      const p = game.player;
      if (d.drunk) p.drunk = Math.max(0, Math.min(1, (p.drunk || 0) + d.drunk));
      if (d.energy) { const f = game.state.flags; f.energy = Math.min(100, (f.energy || 0) + d.energy); f.ateAt = game.time.now(); game.save(); }
      game.ui.toast(d.msg, 3.5); audio.coin();
      return true;
    };
    game.interiors.register({
      id: LOBBY_ID, name: 'The Randolph Hotel', doors: [], background: 0x0c0a08, ambient: 0.45,
      seamless: plan && plan.fit.ok ? plan.seamless : null,
      build(ctx) {
        const r = buildLobby(ctx, game);
        if (ctx.seamless && plan) {
          // two leaves on the one doorway: each is a kit door on its own half (the portal is narrowed for the call)
          const pt = ctx.seamless.portals[0], at0 = pt.at, w0 = pt.w, tx = Math.cos(pt.out), tz = -Math.sin(pt.out);
          R.doorLeaves = [-1, 1].map((sg) => { pt.w = w0 / 2; pt.at = [at0[0] + tx * sg * w0 / 4, at0[1] + tz * sg * w0 / 4]; try { return cityDoor(ctx, plan, { style: 'oak', heavy: true, hinge: sg, open: () => st.open, setBack: 0.12 }); } finally { pt.at = at0; pt.w = w0; } });
        }
        ctx.addExit(LOBBY.exit[0], LOBBY.exit[1], 'Leave the hotel');
        game.interact.add({ place: LOBBY_ID, pos: LOBBY.bar.order, radius: 1.6, label: 'Order at the Morse Bar', onUse: barMenu });
        game.interact.add({ place: LOBBY_ID, pos: [-1.8, 5.6], radius: 1.3, label: 'Read the plaque', onUse: () => game.ui.dialog('Brass plaque', ['THE MORSE BAR', "Renamed in 2001 after Oxford's most famous fictional detective."]) });
        game.interact.add({ place: LOBBY_ID, pos: [3.2, -0.3], radius: 1.6, label: 'Talk to reception', onUse: () => game.ui.dialog('Receptionist', ['Good afternoon, welcome to the Randolph.', 'The fire exits are clearly marked. We get a lot of practice.']) });
        if (ctx.seamless && ctx.seamless.openings.length) {
          // the windows from inside: glass, a stone lining to the pointed head (the mullion and bars are the outside's)
          const ops = ctx.seamless.openings.map((o) => ({ ...o, head: 'pointed', rise: LOBBY_WIN.rise }));
          ctx.scene.add(glazing(ops, { frame: 0.04, bars: 0 }));
          const lin = archLining({ sl: { portals: [], openings: [] } }, ops, { color: 0xd8ccae }); if (lin) ctx.scene.add(lin);
        }
        return r;
      },
      update(dt) { lobbyCrowd.tick(dt); },
      updateShown(dt) { lobbyCrowd.tick(dt); },
    });
    // ---- the people of the hotel: there whenever the lobby is SHOWN (seen from Beaumont Street through the two
    // windows and the doors), gone while it burns or is shut (they are out on the pavement in dressing gowns: CAST).
    // Seeded looks; the cast follows the hour (the bar fills in the evening, a night porter after midnight).
    const band = () => { const h = game.time.hour; return !st.open ? 'shut' : h < 6.5 ? 'night' : h < 11 ? 'morning' : h < 17.5 ? 'day' : 'evening'; };
    const lobbyCrowd = roomCrowd(game, LOBBY_ID, {
      cap: 12, signature: band,
      populate(spawn) {
        const b = band(); if (b === 'shut') return;
        const L = (k, o) => randomLook('randolph-' + k, { outfit: o });
        spawn(LOBBY.reception[0], LOBBY.reception[1], L('reception', 'smart'), { heading: -Math.PI / 2, lines: ['Checking in?', 'Breakfast is from seven.'], label: 'Receptionist' });
        if (b === 'night') { spawn(1.6, -3.9, L('nightporter', 'porter'), { heading: 0.4, lines: ['Evening. Mind the step.', 'Quiet night. So far.'], label: 'Night porter' }); return; }
        spawn(1.5, -3.7, L('doorman', 'porter'), { heading: Math.PI - 0.5, lines: ['Good day to you.', 'Taxi? I can whistle one up.', 'Welcome to the Randolph.'], label: 'Doorman' });
        spawn(2.9, -0.5, L('guest-desk', 'smart'), { heading: Math.PI / 2, pose: 'talk', lines: ['We did ask for a room at the front.', 'Is the fire alarm tested often?'] });
        spawn(-2.6, 2.6, L('guest-chair1', 'tweed'), { heading: Math.PI * 0.8, pose: 'sit', lines: ['Waiting for my wife. Have been since 1998.'] });
        if (b !== 'morning') spawn(-1.0, 3.6, L('guest-chair2', 'smart'), { heading: Math.PI, pose: 'sit', lines: ['The scones are very good.'] });
        spawn(-0.4, -1.2, L('guest-tourist', 'tourist'), { heading: 2.6, pose: 'photo', lines: ['Is this where they filmed Morse?', 'One more of the staircase.'] });
        // the Morse Bar
        spawn(LOBBY.bar.barman[0], LOBBY.bar.barman[1], L('barman', 'barstaff'), { heading: Math.PI, lines: ['What can I get you?', 'Mind the pictures, they were signed.', 'Lovely evening for it.'], label: 'Barman' });
        spawn(-3.95, 7.2, L('drinker1', 'tweed'), { heading: Math.PI / 2, pose: 'sit' });
        if (b !== 'morning') spawn(0.35, 8.6, L('drinker2', 'smart'), { heading: -Math.PI / 2, pose: 'sit' });
        if (b === 'evening') { spawn(-2.05, 7.2, L('drinker3', 'smart'), { heading: -Math.PI / 2, pose: 'sit' }); spawn(-1.3, 10.3, L('drinker4', 'tweed'), { heading: 0, pose: 'stand', lines: ['Same again, please.'] }); spawn(2.75, 7.2, L('drinker5', 'smart'), { heading: Math.PI / 2, pose: 'sit' }); }
      },
    });
    // ---- the outside of the two lobby windows (world scene): each is the facade's own pointed two-light window made
    // real — stone surround, a shaft between two pointed lights, sash rails — in front of the painted one it replaces
    try {
      const d = game.interiors.get(LOBBY_ID);
      if (d && d.sl && d.sl.openings.length) dressOpenings(game, LOBBY_ID, [{ o: [0, 1], head: 'pointed', rise: LOBBY_WIN.rise, wall: 0xd3bd86, stone: 0xe7dcc2,
        surround: { w: 0.2, color: 0xe7dcc2, proud: 0.05 }, mullions: 1, mullW: 0.16, lights: true, frame: { w: 0.05, color: 0xf2efe6 }, bars: [4, 2], barW: 0.03, barColor: 0xf2efe6,
        sill: { h: 0.1, proj: 0.1, over: 0.22, color: 0xe7dcc2 } }]);
    } catch (e) { console.error('[randolph] windows', e); }
    if (plan) warmLater(game, LOBBY_ID);
    R.lobby = () => game.interiors.enter(LOBBY_ID, doorObj); R.plan = () => plan;

    // ------------------------------------------------------------------------------------- state changes
    const flick = { t: 0 };
    const glowCol = new THREE.Color(), nightCol = new THREE.Color(0xffc58a), fireCol = new THREE.Color(0xff5a12);
    let prevPhase = null, near = false, stT = 0;
    const meshes = hotel.meshes;
    function applyPhase() {
      const charred = st.charred || st.phase === 'dying';
      if (meshes.roofBurn) meshes.roofBurn.material = charred ? hotel.charred : hotel.mats.roofBurn;
      const peakGone = st.phase === 'dying' || st.phase === 'aftermath';
      if (meshes.peak) meshes.peak.visible = !peakGone;
      if (meshes.peak2) meshes.peak2.visible = !peakGone;
      scafGroup.visible = st.charred;
      for (const s of scafShapes) s.on = st.charred;
      for (const s of engCol) s.on = st.response;
      syncObstacles(st.response);
      if (!st.hosing && task.carrying) bucket('stop');
    }
    // while the engines are out, pedestrians walk round them and the taped-off pavement, and traffic stops short
    // (game.pedestrians.addObstacle; circles along each engine and along the pavement between the two tapes)
    const obstacles = [];
    function syncObstacles(on) {
      const P = game.pedestrians;
      if (!P || !P.addObstacle) return;
      if (on && !obstacles.length) {
        for (const [x, z] of ENG) for (const dx of [-3, 0, 3]) { const w = L2W(x + dx, z); obstacles.push(P.addObstacle({ x: w[0], z: w[1], r: 1.7 })); }
        for (let x = 2.5; x <= 37.8; x += 3.9) { const w = L2W(x, -2.55); obstacles.push(P.addObstacle({ x: w[0], z: w[1], r: 2.3 })); }
      } else if (!on && obstacles.length) { for (const o of obstacles) P.removeObstacle(o); obstacles.length = 0; }
    }
    function onPhase(prev, next) {
      applyPhase();
      const d = distToHotel();
      if (next === 'climb' && prev === 'smoke' && d < 400 && game.player.place === 'world') audio.siren(d);
      if (next === 'smoke' && prev && game.player.place === 'world' && d < 220) game.ui.toast('Smoke is pouring from the back of the Randolph…', 4);
    }
    function distToHotel() { const p = game.player.place === 'world' ? game.player.pos : game.player.worldPos; return Math.hypot(p.x - CENTRE[0], p.z - CENTRE[1]); }
    applyPhase();

    R.force = (m) => {
      R.forced = m || null; stT = 0; refreshState();
      // snap the smoothed effect values so tests (and late joiners) see the state at once
      flames.u.uProg.value = st.progress; flames.u.uFlame.value = st.flame;
      smoke.u.uDensity.value = st.smoke; smoke.u.uDark.value = st.dark;
      spray.u.uOn.value = st.hosing ? 1 : 0;
      syncCast(game.player.place === 'world' && distToHotel() < NPC_R);
      return st.phase;
    };
    Object.defineProperty(R, 'phase', { get: () => st.phase });
    R.bucket = { grab: () => bucket('grab'), throw: () => bucket('throw'), task };
    R.view = (x, y, z, tx, ty, tz, fov = 60) => {
      game.beginActivity({ name: 'view', pointer: 'free', camera(dt, cam) { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, z); cam.lookAt(tx, ty, tz); }, onEnd() { game.camera.fov = 60; game.camera.updateProjectionMatrix(); } });
    };
    R.local = (x, y, z) => L2W3([x, y, z]);
    Object.defineProperty(R, 'obstacles', { get: () => obstacles });
    R.stats = () => {
      let calls = 0, tris = 0;
      const count = (o) => o.traverse((m) => { if (m.isMesh || m.isPoints) { if (!m.visible || (m.parent && !m.parent.visible)) return; calls++; const g = m.geometry; tris += g.isInstancedBufferGeometry ? (g.index.count / 3) * g.instanceCount : (g.index ? g.index.count : g.attributes.position.count) / 3; } });
      count(hotel.group); count(hotel.wings); count(respGroup); count(scafGroup); for (const o of [flames, smoke, embers, spray]) if (o.mesh.visible) count(o.mesh);
      return { phase: st.phase, calls, tris: Math.round(tris), npcs: cast.size, render: { ...game.renderer.info.render } };
    };
    function refreshState() {
      fireState(game.time.now(), R.forced, st);
      if (st.phase !== prevPhase) { const p = prevPhase; prevPhase = st.phase; onPhase(p, st.phase); }
    }
    refreshState();
    flames.u.uProg.value = st.progress; flames.u.uFlame.value = st.flame; smoke.u.uDensity.value = st.smoke; smoke.u.uDark.value = st.dark;
    console.log(`[randolph] built in ${(performance.now() - t0).toFixed(0)} ms: ${hotel.calls} draw calls, ${(hotel.tris / 1000).toFixed(1)}k tris (idle); phase ${st.phase}`);

    // ------------------------------------------------------------------------------------- per frame
    return {
      update(dt) {
        stT -= dt;
        if (stT <= 0) { stT = 0.25; refreshState(); }
        const d = distToHotel();
        // smoke column: visible city-wide, uniforms only
        const su = smoke.u;
        su.uDensity.value += (st.smoke - su.uDensity.value) * Math.min(1, dt * 0.8);
        su.uDark.value += (st.dark - su.uDark.value) * Math.min(1, dt * 0.5);
        const sk = smooth(0.08, 0.6, st.progress);
        su.uSrc.value.lerpVectors(smokeA, smokeB, sk);
        su.uGlow.value = flames.u.uFlame.value * smooth(0.4, 0.9, flames.u.uProg.value) * world.night;
        smoke.mesh.visible = su.uDensity.value > 0.004;
        const wasNear = near;
        near = d < FAR;
        if (!near) {
          if (wasNear) { flames.mesh.visible = embers.mesh.visible = spray.mesh.visible = false; respGroup.visible = false; light.intensity = 0; audio.stop(); syncCast(false); }
          meshes.wallTop.material.emissive.copy(nightCol); meshes.wallTop.material.emissiveIntensity = world.night * 1.15;
          return;
        }
        flick.t += dt;
        const fu = flames.u;
        fu.uProg.value += (st.progress - fu.uProg.value) * Math.min(1, dt * 1.5);
        fu.uFlame.value += (st.flame - fu.uFlame.value) * Math.min(1, dt * 0.7);
        const fl = fu.uFlame.value, active = fl > 0.01;
        flames.mesh.visible = active;
        embers.u.uOn.value = fl * smooth(0.45, 0.6, fu.uProg.value); embers.mesh.visible = embers.u.uOn.value > 0.01;
        const ffOn = st.hosing && cast.has('ff1');
        spray.u.uOn.value += ((ffOn ? 1 : 0) - spray.u.uOn.value) * Math.min(1, dt * 2); spray.mesh.visible = spray.u.uOn.value > 0.02;
        respGroup.visible = st.response;
        // flicker
        const T = flick.t, f = 0.65 + 0.2 * Math.sin(T * 13.1) + 0.15 * Math.sin(T * 7.3 + 1.3) + 0.1 * Math.sin(T * 29.7);
        light.intensity = active ? fl * smooth(0.1, 0.5, fu.uProg.value) * (220 + 160 * f) * (0.12 + 0.88 * world.night) : 0;
        const glow = fl * smooth(0.5, 0.9, fu.uProg.value);
        const wt = meshes.wallTop.material;
        glowCol.copy(nightCol).lerp(fireCol, glow); wt.emissive.copy(glowCol);
        wt.emissiveIntensity = world.night * 1.15 * (1 - glow) + glow * (1.6 + 1.4 * f);
        blueMat.emissiveIntensity = st.response ? (((T * 3.2) % 1 < 0.22 || (T * 3.2 + 0.45) % 1 < 0.22) ? 5 : 0.15) : 0;
        audio.update(dt, game.player.place === 'world' ? d : 1e9, fl * smooth(0.05, 0.5, fu.uProg.value));
        // people (only outdoors and nearby)
        if ((flick.n = (flick.n || 0) + 1) % 15 === 0) syncCast(game.player.place === 'world' && d < NPC_R);
        // fire alarm while you're inside
        if (game.player.place === LOBBY_ID && !st.open) {
          if (alarmT === 0) { alarmT = 2.6; audio.alarm(2.6); game.ui.toast('FIRE ALARM! Everybody out — again.', 3.5); }
          else if (alarmT > 0 && (alarmT -= dt) <= 0) {
            alarmT = -1;
            if (game.activity) game.endActivity();
            while (game.ui.inDialog) game.ui.advanceDialog();
            game.interiors.exit().then(() => game.ui.toast('You join the other guests on the pavement in Beaumont Street.', 4));
          }
        } else if (game.player.place !== LOBBY_ID) alarmT = 0;
      },
    };
  },
};
