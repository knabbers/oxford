// 5, 6 & 7 Beaumont Street — Worcester College's third-year houses between the Randolph and the Playhouse, built by
// hand over OSM r13335393 from the college's accommodation page photographs (docs/research/worcester.md "Beaumont
// Street accommodation"): the cream stucco No. 5 (four storeys, the blue plaque) and the Bath-stone pair Nos 6 and 7
// (three storeys, Tuscan door-cases, iron balconettes) on the street; behind them the COURTYARD and the orange,
// timber-clad courtyard house of the college's courtyard photograph, laid out as the user — who lived in it —
// described it ("Beaumont Street: the courtyard house" in the same file). Plan and measurements: _wbmt_plan.js;
// geometry: _wbmt_build.js (fronts, passage), _wbmt_site.js (courtyard, the block's shell, the masses round it),
// _wbmt_block.js (the block's rooms); Go: _wbmt_go.js.
//
// The way in, all on foot through real hinged doors (no prompt, no fade, no teleport):
//   Beaumont Street -> the black front door of No. 7 -> its PASSAGE (walk-in room `worcester_beaumont7`, two doorways to
//   the world) -> the back door -> the courtyard (the world: open to the sky, the weather and the hour) -> along the
//   path -> the door of the courtyard house (walk-in room `worcester_beaumont_court`, two storeys): room 1 on the left,
//   the kitchen on the right, the winding stair ahead; at its head rooms 2 and 3 and, on the right, Matt's room with
//   its keyboard and the square white bathroom in its corner, where Go is.
// Both rooms are on the shared mechanism (core/interiors.js "seamless"; docs/ARCHITECTURE.md "Walk-in interiors"):
//   · the SHELLS (the outdoor scene) have real modelled openings, so every portal and opening says `punch: false`;
//   · the ROOMS are in the registered rooms' own scenes, in the room frame = the houses' front frame (x = s west along
//     the front, z = out to the street, y above the ground at the wall), in place at their true floor heights;
//   · collision: the passage has one collider; the courtyard house one per storey (ctx.newCollider) chosen by the
//     height of your feet (ctx.setCollider); floors and the stair are a ground function (ctx.setGround);
//   · doors: ctx.addDoor (core/_doors.js) — nine leaves; the three on doorways to the world close their portals.
// Light: unlit, vertex-tinted meshes, one per zone, whose colour follows daylight and the lamps (plan.lit).
// `?beaumont=0` (node GTO_BEAUMONT=0): the generic city building, no interior. Test hooks: game.beaumont.
import * as THREE from 'three';
import { Batch, makePack } from './_worcester_kit.js';
import { createCharacter, randomLook } from '../core/characters.js';
import * as PL from './_wbmt_plan.js';
import { buildExterior, buildPassage, interiorGeometries, glassGeometry, paintDecals, paintRooms, paintGrain } from './_wbmt_build.js';
import { blockGlass } from './_wbmt_site.js';
import { buildBlock } from './_wbmt_block.js';
import { createGo } from './_wbmt_go.js';
import { createPiano } from './_music_piano3d.js';
import { createSession } from './_music_session.js';
import { PianoEngine } from './_music_synth.js';

const { BEAUMONT, ID, ROOM_ID, BLOCK_ID, L2W, IN, BK, PAVE, FRONT, DEPTH } = PL;

export default {
  id: 'worcester_beaumont',

  preMap(game) {
    if (!BEAUMONT) return;
    game.overrides.skip.add(ID);
  },

  install(game) {
    if (!BEAUMONT) { game.beaumont = { on: false }; return {}; }
    const world = game.world, col = game.worldCollider, t0 = performance.now();
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    const D = paintDecals();
    // our own tints of the college's atlas cells (data only: the same material, no new texture or program)
    { const K = pack.cells, lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }, tint = (key, from, hex, o = {}) => { if (!K.has(key)) K.set(key, { ...K.get(from), tint: Array.isArray(hex) ? hex : lin(hex), ...o }); };
      tint('bmtStone', 'stone', [1.12, 0.98, 0.78]); tint('bmtDress', 'stoneDress', [1.2, 1.06, 0.86]); tint('bmtStucco', 'plaster', 0xefe6d0);
      // the courtyard (photographs): orange and cream render, white-painted and blue glazed brick, blue-grey joinery, zinc, cedar
      tint('bmtOrange', 'plaster', 0xe2a055); tint('bmtCream', 'plaster', 0xe9e2cb); tint('bmtRear', 'plaster', 0xe4e9ea);
      tint('bmtWhiteBrick', 'buff', [1.45, 1.7, 3.1]); tint('bmtBlueBrick', 'buff', [0.16, 0.2, 0.62]); tint('bmtBrown', 'buff', [0.86, 0.74, 0.62]);
      tint('bmtFrame', 'plaster', 0x7f93a6); tint('bmtZinc', 'plaster', 0x8b949a); tint('bmtCedar', 'boards', 0xb5703c);
      tint('bmtLiner', 'plaster', 0x4a463c); tint('bmtTwig', 'plaster', 0x6a5a48); tint('bmtDry', 'plaster', 0xb89a72); tint('bmtDry2', 'plaster', 0x9a7a54); tint('bmtSage', 'plaster', 0x8a9a7a); tint('bmtBinG', 'plaster', 0x2f5a3a); tint('bmtBinB', 'plaster', 0x2a4a7a); tint('bmtBikeA', 'plaster', 0x2a5a8a); tint('bmtBikeB', 'plaster', 0x8a2a2a); }
    // ironwork, numerals and the plaque: alpha decals (the same kind of material as the college's signs)
    const decal = new THREE.MeshStandardMaterial({ map: D.texture, roughness: 0.6, emissive: 0xfff0d8, emissiveMap: D.texture, emissiveIntensity: 0, transparent: true, alphaTest: 0.04, depthWrite: false, side: THREE.DoubleSide });
    world.registerNight(decal, 0.3);
    // the bulkhead lamps over the doors in the courtyard: the glow of their lenses and the pool of light each throws on
    // the setts and the wall after dark (one small unlit, additive mesh: no light is added to the scene)
    const poolMat = new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 31); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.45, 'rgba(255,200,130,0.42)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

    // ---------------------------------------------------------------- the houses and the courtyard (the shell: outdoor scene)
    const grp = new THREE.Group(); grp.name = 'beaumont-5-7';
    grp.position.set(PL.E0[0], PAVE, PL.E0[1]); grp.rotation.y = Math.atan2(-PL.DIR[1], PL.DIR[0]);
    const B = new Batch();
    const ext = buildExterior(B, D);
    const extTris = B.tris();
    const meshes = B.build({ bmtDecal: decal, bmtPool: poolMat }, grp, { pack, noCast: new Set(['bmtDecal', 'bmtPool']) });
    for (const m of meshes) { if (m.material === decal) { m.castShadow = false; m.renderOrder = 2; } else if (m.material === poolMat) { m.castShadow = false; m.receiveShadow = false; m.renderOrder = 3; } else if (pack.shade && m.material === pack.atlas) { try { pack.shade(m.geometry); } catch { /* no eave shading */ } } }
    world.addStatic(grp);

    // ---------------------------------------------------------------- the shell's collision (world collider)
    const seg = (a, b, o = {}) => { const p = L2W(a[0], a[1]), q = L2W(b[0], b[1]); return col.addSegment(p[0], p[1], q[0], q[1], { tag: 'building', ...o }); };
    { // the plot's outline, the front unbroken: each doorway is opened by its room's portal (a passage through the wall
      // while its door is open), and the guides keep you in the doorway's width on the way through
      const O = PL.OUTLINE, H = 9.3;
      for (let i = 0; i < O.length - 1; i++) seg(O[i], O[i + 1], { h: H });
      seg([FRONT, 0], [0, 0], { h: H });
      for (const [a, b] of PL.COURT_WALLS) seg(a, b, { h: 6 });
      const W = PL.DOORWAY, Wb = PL.BACKWAY, Dt = BK.DOOR.t, g = 0.69;
      for (const sx of [-1, 1]) {
        seg([W.s + sx * W.guide, 0], [W.s + sx * W.guide, 0.9], { h: H });
        seg([Wb.s + sx * Wb.guide, DEPTH], [Wb.s + sx * Wb.guide, DEPTH - 0.85], { h: H });
        seg([PL.BLOCK.s1, Dt + sx * g], [PL.BLOCK.s1 - 0.85, Dt + sx * g], { h: 6 });
      }
      // in the courtyard: the six-sided planter, the low planter at the block's corner, the row of bikes
      const P = PL.PLANTER; for (let i = 0; i < 6; i++) { const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2; seg([P.s + Math.sin(a0) * P.r, P.t + Math.cos(a0) * P.r], [P.s + Math.sin(a1) * P.r, P.t + Math.cos(a1) * P.r], { h: 1.6, tag: 'furniture' }); }
      const rect = (s0, s1, ta, tb, h) => { seg([s0, ta], [s1, ta], { h, tag: 'furniture' }); seg([s1, ta], [s1, tb], { h, tag: 'furniture' }); seg([s1, tb], [s0, tb], { h, tag: 'furniture' }); seg([s0, tb], [s0, ta], { h, tag: 'furniture' }); };
      rect(18.75, 20.55, 11.8, 12.4, 0.9); rect(...PL.BIKES.box, 1.1);
    }
    // the stone steps and the thresholds in the walls' thickness (outdoors: you are in the passage from its wall faces
    // on): discs you can stand on (never walls), their tops measured from the drawn ground under them
    let discs = 0;
    { const disc = (s, t, r, y) => { const [x, z] = L2W(s, t); col.addCircle(x, z, r, { top: Math.max(0.01, y + PAVE - world.groundHeight(x, z)), low: true, floor: true, tag: 'floor' }); discs++; };
      for (const s of [20.72, 21.01, 21.3, 21.59, 21.88]) disc(s, -0.27, 0.22, PL.LEVELS.step);
      for (const t of [0.12, 0.42]) for (const s of [21.06, 21.3, 21.54]) disc(s, t, 0.2, IN.G);
      for (const s of [21.06, 21.3, 21.54]) disc(s, DEPTH - 0.1, 0.2, IN.G);
      for (const s of [20.78, 21.04, 21.3, 21.56, 21.82]) disc(s, DEPTH + 0.26, 0.22, IN.G); }

    // ---------------------------------------------------------------- the two walk-in rooms
    const P = game.player, ui = game.ui, I = game.interiors;
    const std = (c, r, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const flat = (c, o = {}) => { const m = new THREE.MeshBasicMaterial({ color: c, ...o }); m.userData.base = new THREE.Color(c); return m; };
    // (the front door is lit by the room's ambient, which follows the hour; the other doors are unlit like the rooms and
    // follow their hall's light)
    const DM = { black: std(0x0d0e10, 0.32), brass: std(0xc8a050, 0.35, 0.7) };
    const doorMats = () => ({ white: flat(0xf1efe6), steel: flat(0x8a8c8e), plate: flat(0x1f5fae), grey: flat(0x7f93a6), glass: flat(0xa9c0cf, { transparent: true, opacity: 0.32, depthWrite: false }) });
    const DMP = doorMats(), DMB = doorMats();
    const zoneMat = {}, zoneGrain = {}, warm = new THREE.Color(1.0, 0.8, 0.54), cool = new THREE.Color(0.94, 0.97, 1.0);
    const stats = { extTris, inTris: 0, blockTris: 0, meshes: meshes.length, discs, roomMeshes: 0, blockMeshes: 0, counts: ext.counts, site: ext.site, ms: Math.round(performance.now() - t0), roomMs: 0, blockMs: 0 };
    let RP = null, RB = null;         // what the two builds made: { inner, doors, glass, amb, hemi, colliders }
    let level = 0, defP = null, defB = null, go = null, piano = null, session = null, bathOn = true;
    const inPass = () => P.place === ROOM_ID, inBlock = () => P.place === BLOCK_ID, inside = () => inPass() || inBlock();
    /** the storey somebody is on in the courtyard house, by the height of their feet — it only changes on the stair */
    const levelOf = (p) => { if (p && p.place === BLOCK_ID && PL.onStair(p.pos.x, p.pos.z)) level = p.pos.y > PL.LEVEL_Y ? 1 : 0; return level; };
    const floorY = (lv) => (lv === 'pass' ? IN.G : lv ? BK.F1 : BK.G);

    /** hang one of the plan's doors in a room (core/_doors.js through ctx.addDoor: people walking at it open it) */
    function hang(ctx, d, mats, cols) {
      const h = [d.hinge[0], -d.hinge[1]], l = [d.latch[0], -d.latch[1]], dir = Math.atan2(l[0] - h[0], l[1] - h[1]);
      // which way it is hung: the plan's `into` ([ds, dt], front frame; room frame [ds, -dt]) against the leaf's own normal
      const n = [Math.cos(dir), -Math.sin(dir)], swing = n[0] * d.into[0] - n[1] * d.into[1] > 0 ? 1 : -1;
      const front = d.id === 'front', y = d.room === 'pass' ? IN.G : d.level ? BK.F1 : BK.G, W = d.w - 0.012;
      const opts = { kind: 'hinged', at: h, y, w: W, h: d.h - 0.01, dir, swing, closer: d.closer, heavy: d.mass > 30, hold: d.hold, style: front ? 'oak' : 'fire', handleY: d.knob, thick: front ? 0.05 : 0.044,
        plate: !front && d.closer && !d.vision, colliders: cols,
        mats: front ? { leaf: DM.black, handle: DM.brass } : d.vision ? { leaf: mats.grey, handle: mats.steel, glass: mats.glass } : { leaf: mats.white, handle: mats.steel, plate: mats.plate } };
      if (d.vision) opts.vision = [W * 0.3, W * 0.72, 1.02, 1.78];
      if (d.rest !== undefined) opts.rest = d.rest;
      if (d.portal !== undefined) opts.portal = d.portal;
      const door = ctx.addDoor(opts);
      // (a door with no closer starts where it was left: ajar)
      if (d.rest !== undefined && d.closer === false) { door.side = swing; door.target = d.rest; door.th = swing * d.rest; door.open = d.rest / 1.5; door.group.rotation.y = dir + door.th; if (door.sync) door.sync(); }
      return { ...d, door, y, swingSign: swing };
    }
    const zoneMeshes = (IB, RA, group) => {
      const G = paintGrain();
      for (const [name, geo] of interiorGeometries(IB, RA)) {
        // (a zone's furniture and pictures: the rooms' atlas; its walls, ceilings and carpets: a repeating grain)
        const [zone, tile] = name.split('~'), m = new THREE.MeshBasicMaterial({ map: tile ? G.grain : RA.texture, vertexColors: true });
        if (tile) (zoneGrain[zone] || (zoneGrain[zone] = [])).push(m); else zoneMat[zone] = m;
        const mesh = new THREE.Mesh(geo, m); mesh.name = 'beaumont:' + name; mesh.castShadow = false; mesh.receiveShadow = false;
        group.add(mesh);
      }
    };
    const paneMesh = (geo) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: D.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.name = 'beaumont:glass'; m.renderOrder = 2; m.castShadow = false; m.receiveShadow = false; return m; };
    const addSolid = (S, cols) => {
      const sg = (a, b) => { for (const c of cols) c.addSegment(a[0], -a[1], b[0], -b[1]); };
      for (const [a, b] of S.segs) sg(a, b);
      for (const [s0, s1, ta, tb] of S.boxes) { sg([s0, ta], [s1, ta]); sg([s1, ta], [s1, tb]); sg([s1, tb], [s0, tb]); sg([s0, tb], [s0, ta]); }
    };
    const lightsOf = (sc) => { let amb = null, hemi = null; sc.traverse((o) => { if (o.isAmbientLight) amb = o; else if (o.isHemisphereLight) hemi = o; }); return { amb, hemi }; };

    // ---- No. 7's passage
    function buildPass(ctx) {
      const tb = performance.now(), sc = ctx.scene, c0 = ctx.collider, RA = paintRooms();
      const inner = new THREE.Group(); inner.name = 'beaumont-7-inside';
      const IB = new Batch(); buildPassage(IB); stats.inTris = IB.tris();
      zoneMeshes(IB, RA, inner);
      const glass = paneMesh(glassGeometry(D)); inner.add(glass);      // the fanlight's pane: over the live street from indoors
      sc.add(inner); stats.roomMeshes = inner.children.length;
      addSolid(PL.SOLID_PASS, [c0]);
      { const W = PL.DOORWAY, Wb = PL.BACKWAY; for (const sx of [-1, 1]) { c0.addSegment(W.s + sx * W.guide, -IN.WT, W.s + sx * W.guide, 0.3); c0.addSegment(Wb.s + sx * Wb.guide, -IN.T1, Wb.s + sx * Wb.guide, -DEPTH - 0.45); } }      // (the doorways' guides: see _wbmt_plan.js DOORWAY)
      const doors = PL.DOORS.filter((d) => d.room === 'pass').map((d) => hang(ctx, d, DMP, [c0]));
      ctx.setGround(() => IN.G);
      if (ctx.addExit) ctx.addExit(PL.DOORWAY.s, -0.95, 'Leave');      // (null for a walk-in room: only the old door-prompt path has a "Leave")
      RP = { inner, doors, glass, colliders: { ground: c0 }, ...lightsOf(sc), scene: sc };
      light();
      stats.roomMs = Math.round(performance.now() - tb);
      // the two students' figures, parked out of sight in the passage, so that the character program for this room's
      // lights is compiled off the frame and not when the first person steps in
      Promise.resolve().then(() => { try {
        for (const S of students) { if (!ensure(S) || S.shown) continue; S.ch.group.visible = false; S.ch.group.position.set(21.3, IN.G, -6.2); sc.add(S.ch.group);
          const Rn = game.renderer; if (Rn && Rn.compileAsync && game.camera) { const pr = Rn.compileAsync(S.ch.group, game.camera, sc); if (pr && pr.catch) pr.catch(() => {}); } }
      } catch (e) { console.warn('[beaumont] student warm-up', e); } });
      return { spawn: [PL.DOORWAY.s, -1.4], heading: Math.PI };
    }

    // ---- the courtyard house
    function buildCourtHouse(ctx) {
      const tb = performance.now(), sc = ctx.scene, c0 = ctx.collider, c1 = ctx.newCollider ? ctx.newCollider() : ctx.collider, RA = paintRooms();
      const inner = new THREE.Group(); inner.name = 'beaumont-court-inside';
      const IB = new Batch(); buildBlock(IB); stats.blockTris = IB.tris();
      zoneMeshes(IB, RA, inner);
      const glass = paneMesh(blockGlass(D)); inner.add(glass);
      sc.add(inner); stats.blockMeshes = inner.children.length;
      // collision: a collider per storey
      const both = c1 === c0 ? [c0] : [c0, c1];
      addSolid(PL.SOLID.both, both); addSolid(PL.SOLID[0], [c0]); addSolid(PL.SOLID[1], [c1]);
      { const Dt = BK.DOOR.t, g = 0.69; for (const sx of [-1, 1]) c0.addSegment(BK.S1, -(Dt + sx * g), BK.S1 + BK.WALL + 0.5, -(Dt + sx * g)); }
      if (ctx.portalColliders) ctx.portalColliders(0, [c0]);            // (the door is in the ground storey's wall)
      const doors = PL.DOORS.filter((d) => d.room === 'block').map((d) => hang(ctx, d, DMB, [d.level ? c1 : c0]));
      // floors: the two storeys overlap in plan everywhere, so the storey is carried (it changes on the stair)
      ctx.setGround((x, z) => PL.groundAt(x, z, level));
      if (ctx.setCollider) ctx.setCollider((p) => (levelOf(p) ? c1 : c0));
      // Go, on the toilet in Matt's bathroom
      try { go = createGo(game, sc); } catch (e) { console.warn('[beaumont] Go', e); go = null; }
      // Matt's keyboard: a stage piano that can be played (the Music Faculty's piano session, here local only: no
      // booking, no neighbour, nothing relayed to other players)
      try { const KB = PL.KB, wall = BK.HN - 0.05, pn = createPiano('stage'); pn.group.position.set(KB.s, BK.F1, -(wall - KB.back)); sc.add(pn.group);
        piano = { id: 'beaumont', kind: 'stage', piano: pn, room: 'beaumont', label: 'Matt\'s keyboard', local: true, hint: 'You sit down at the keyboard and put the headphones on.', seat: [KB.s, -(wall - KB.seatT)], heading: Math.PI, y0: BK.F1 };
      } catch (e) { console.warn('[beaumont] keyboard', e); piano = null; }
      ensuite = doors.find((q) => q.id === 'ensuite') || null;
      RB = { inner, doors, glass, colliders: { ground: c0, first: c1 }, ...lightsOf(sc), scene: sc };
      light();
      stats.blockMs = Math.round(performance.now() - tb);
      return { spawn: [BK.S1 - 1.2, -BK.DOOR.t], heading: -Math.PI / 2 };
    }

    function light() {
      const d = game.time.daylight ?? 1, night = 1 - d, hour = game.time.hour ?? 12, L = PL.lit(hour, night), iP = inPass(), iB = inBlock();
      let lampsP = 0, lampsB = 0;
      for (const z of PL.ZONES) {
        const m = zoneMat[z]; if (!m) continue;
        const pass = z === 'pass', mine = pass ? iP : iB, on = L[z] || (mine && night > 0.45);
        // (by day a room seen from outside is dimmer behind its glass; from inside, your eyes are used to it)
        if (z === 'bath') m.color.copy(cool).multiplyScalar(bathOn ? 0.9 : 0.1 + 0.12 * d);
        else if (on) { m.color.copy(warm).multiplyScalar(0.8 - 0.2 * d); if (pass) lampsP++; else lampsB++; }
        else m.color.setScalar(0.05 + (mine ? (pass ? 0.56 : 0.8) : 0.42) * d);
        if (zoneGrain[z]) for (const q of zoneGrain[z]) q.color.copy(m.color);
      }
      const follow = (mats, zone) => { const z = zoneMat[zone]; if (z) for (const k of ['white', 'steel', 'plate', 'grey']) mats[k].color.copy(mats[k].userData.base).multiply(z.color); };
      follow(DMP, 'pass'); follow(DMB, 'bhall');
      for (const [R, lamps] of [[RP, lampsP], [RB, lampsB]]) {
        if (!R) continue;
        // people and the front door are lit by the room's ambient: the day through the windows, or the lamps
        const k = Math.max(d, lamps ? 0.55 : R === RB ? 0.3 : 0.08);
        if (R.amb) R.amb.intensity = 0.1 + 0.45 * k; if (R.hemi) R.hemi.intensity = 0.08 + 0.42 * k;
        R.glass.material.color.setScalar(0.25 + 0.75 * d);
      }
      // the courtyard's lamps come on at dusk
      { const n = Math.max(0, Math.min(1, (night - 0.35) / 0.3)); poolMat.opacity = 0.5 * n; poolMat.visible = n > 0.01; }
      return L;
    }
    // WORK-ROUND (core): a portal's passage frees everything in the doorway, the swinging leaf's own wall segment
    // included, and these doors open INTO a narrow hall — so a leaf that is held part open (it never swings through a
    // person) could be walked through at its tip. While you are in the room the open leaf of a doorway to the world
    // stays solid here.
    function keepOffLeaf(R) {
      if (!R || (R === RB && level)) return;
      for (const q of R.doors) {
        if (q.portal === undefined) continue;
        const Dr = q.door, o = Dr.o; if (Math.abs(Dr.th) < 0.05) continue;
        const a = o.dir + Dr.th, ex = Math.sin(a) * o.w, ez = Math.cos(a) * o.w, px = P.pos.x - o.at[0], pz = P.pos.z - o.at[1];
        const t = Math.max(0, Math.min(1, (px * ex + pz * ez) / (ex * ex + ez * ez))), qx = px - ex * t, qz = pz - ez * t, dd = Math.hypot(qx, qz), need = 0.31 - dd;
        if (need > 0 && dd > 1e-4) { P.pos.x += (qx / dd) * need; P.pos.z += (qz / dd) * need; }
      }
    }
    let lt = 0;
    const tickLight = (dt) => { if ((lt -= dt) <= 0) { lt = 0.5; light(); } };
    const goEnv = { lit: true, door: 0 };
    const goTick = (dt) => { if (go) { try { goEnv.lit = bathOn; goEnv.door = ensuite ? ensuite.door.th : 0; go.update(dt, inBlock() ? P.pos : null, goEnv); } catch (e) { if (!go.err) console.warn('[beaumont] Go', e); go.err = true; } } };
    let ensuite = null;
    /** sit down at Matt's keyboard and play (places/_music_session.js; made on first use) */
    function playKeyboard() {
      try {
        if (!piano) throw new Error('no keyboard');
        if (!session) session = createSession(game, { engine: (game.music && game.music.engine) || new PianoEngine(game.audio), inPracticeRoom: () => false, onSit: null, onStand: null });
        session.sit(piano); return true;
      } catch (e) { console.warn('[beaumont] keyboard', e); ui.toast('Eighty-eight weighted keys on an X-stand, headphones plugged in so the neighbours cannot complain.', 4); return false; }
    }

    // the students (below) are in world coordinates; the doors hear of them through game.walkers
    const students = [0, 1].map((i) => ({ i, ch: null, shown: false, hidden: true, h: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, on: false, inside: false, inRoom: false }));
    if (I && I.register) {
      const dw = L2W(PL.DOORWAY.s, -1.3), bw = L2W(PL.BLOCK.s1 + 1.3, BK.DOOR.t);
      defP = I.register({
        id: ROOM_ID, name: '7 Beaumont Street', background: 0x0b0a08, ambient: 0.5,
        doors: [{ pos: dw, facing: PL.HEADING_OUT, label: 'Enter 7 Beaumont Street', radius: 1.5 }],      // (kept for tools: enterNow / the exit teleport)
        seamless: PL.SEAMLESS,
        build: buildPass,
        updateShown: tickLight,                                    // lights by the hour while the rooms are only seen from outside
        onEnter: () => { lt = 0; light(); },
        onExit: () => { lt = 0; },
        update: (dt) => { keepOffLeaf(RP); tickLight(dt); },
      });
      defB = I.register({
        id: BLOCK_ID, name: 'Beaumont Street, the courtyard house', background: 0x0b0a08, ambient: 0.5,
        doors: [{ pos: bw, facing: PL.HEADING_OUT + Math.PI / 2, label: 'Enter the courtyard house', radius: 1.5 }],
        seamless: PL.SEAMLESS_BLOCK,
        build: buildCourtHouse,
        updateShown: (dt) => { goTick(dt); },                      // (seen through the windows from the courtyard: he still sits there)
        onEnter: () => { level = P.pos.y > PL.LEVEL_Y ? 1 : 0; lt = 0; light(); },
        onExit: () => { level = 0; lt = 0; },                     // (the next updateShown relights the rooms for the view from outside)
        update: (dt) => { levelOf(P); keepOffLeaf(RB); tickLight(dt); goTick(dt); if (piano && !(session && session.active)) piano.piano.update(dt); },
      });
      // built and compiled on the loading screen (they are seen through their own doorways and windows)
      if (I.warm) (game.warmups = game.warmups || []).push({ id: 'worcester_beaumont', fn: () => { I.warm(ROOM_ID); I.warm(BLOCK_ID); } });
    }
    const slOf = (def) => (def && def.sl) || null;

    // ---------------------------------------------------------------- things to do inside (room coordinates)
    const spot = (s, t, lv = 0) => [s, floorY(lv), -t];
    const hereB = (lv) => () => inBlock() && level === lv;
    const SP = PL.SPOTS;
    game.interact.add({ place: ROOM_ID, pos: spot(...SP.notice), radius: 0.9, label: 'Read the noticeboard', enabled: inPass, onUse: () => ui.toast('The fire drill for 5, 6 & 7 Beaumont Street, a note about bikes in the courtyard, and three takeaway menus.', 4.5) });
    game.interact.add({ place: BLOCK_ID, pos: spot(...SP.tea), radius: 0.9, label: 'Make a cup of tea', enabled: hereB(0), onUse: () => { game.state.energy = Math.max(0, Math.min(100, (game.state.energy ?? 70) + 10)); ui.toast(`Tea in the shared kitchen. Somebody has labelled every shelf of the fridge. Energy ${Math.round(game.state.energy)}/100.`, 4); } });
    game.interact.add({ place: BLOCK_ID, pos: spot(...SP.kitchenNotice), radius: 0.9, label: 'Read the kitchen noticeboard', enabled: hereB(0), onUse: () => ui.toast('A washing-up rota nobody follows, and a note: "Whoever keeps using my milk, I know it is you."', 4.5) });
    game.interact.add({ place: BLOCK_ID, pos: spot(...SP.bed), radius: 0.8, label: 'Sleep', enabled: hereB(1), onUse: () => ui.fade(() => { game.state.energy = 100; try { game.save(); } catch { /* storage blocked */ } }).then(() => ui.toast('You sleep in your old room, over the courtyard. Energy 100/100.', 3.5)) });
    game.interact.add({ place: BLOCK_ID, pos: spot(...SP.desk), radius: 0.8, label: 'Look at the desk', enabled: hereB(1), onUse: () => ui.toast('A reading list, a library book due back last week, and a page of music with the fingering pencilled in.', 4) });
game.interact.add({ place: BLOCK_ID, pos: spot(...SP.keyboard), radius: 0.75, label: 'Play the keyboard', enabled: hereB(1), onUse: () => playKeyboard() });
    game.interact.add({ place: BLOCK_ID, pos: spot(...SP.bathLight), radius: 0.55, label: 'Switch the bathroom light', enabled: hereB(1), onUse: () => { bathOn = !bathOn; lt = 0; light(); if (game.net && game.net.actions) game.net.actions.switch('beaumont-bath', bathOn); try { game.audio && game.audio.click && game.audio.click(); } catch { /* */ } } });
    if (game.net && game.net.actions) game.net.actions.onSwitch('beaumont-bath', (on) => { bathOn = on; lt = 0; });      // (another player pressed it: core/_mp_actions.js; the next light tick shows it)
    game.interact.add({ place: BLOCK_ID, pos: spot(16.35, 14.9, 1), radius: 0.85, label: 'Talk to Go', enabled: () => inBlock() && level === 1 && !!go, onUse: () => { if (go) go.talk(); } });

    // ---------------------------------------------------------------- the two students (shared clock)
    // Simulated in WORLD coordinates as a pure function of the shared clock (PL.studentAt: along the pavement, through
    // the front door, down the passage). Each is DRAWN by core's `game.interiors.place(group, wx, wy, wz, heading)`: in
    // the room's scene (room coordinates) from the doorway inwards — by the room's declared bounds — and in the outdoor
    // scene on the pavement.
    const now = () => (game.time && game.time.now ? game.time.now() : Date.now()) / 1000;
    function placeFigure(g, wx, wy, wz, heading, indoors) {
      if (I && I.place) { g.visible = true; return I.place(g, wx, wy, wz, heading); }
      // (an Interiors without place() — the headless stub: outdoors only; nobody can see in)
      g.visible = !indoors;
      if (g.parent !== game.worldScene) game.worldScene.add(g);
      g.position.set(wx, wy, wz); g.rotation.y = heading; return null;
    }
    function ensure(S) {
      if (S.ch || S.broken) return !!S.ch;
      try { S.ch = createCharacter(randomLook('beaumont-' + S.i, { outfit: 'casual' })); S.ch.group.visible = false; game.worldScene.add(S.ch.group); } catch (e) { console.warn('[beaumont] student', e); S.broken = true; }
      return !!S.ch;
    }
    function studentTick(S, dt, near) {
      const st = near ? PL.studentAt(S.i, now()) : null;
      S.on = !!st;
      if (st && !ensure(S)) return;
      if (!S.ch) return;
      const wh = st ? Math.atan2(PL.DIR[0] * st.ds - PL.OUT[0] * st.dt, PL.DIR[1] * st.ds - PL.OUT[1] * st.dt) : 0;
      if (!!st !== S.shown) { S.shown = !!st; S.hidden = !st; if (st) S.h = wh; else S.ch.group.visible = false; }
      if (!st) { S.vx = S.vz = 0; S.inside = false; S.fresh = true; return; }
      const [x, z] = L2W(st.s, st.t);
      let dh = wh - S.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); S.h += dh * Math.min(1, dt * 6);
      const v = st.moving ? 1.3 : 0; S.vx = Math.sin(wh) * v; S.vz = Math.cos(wh) * v; S.x = x; S.z = z;
      const gy = world.groundHeight(x, z), yG = IN.G + PAVE;
      const y = st.t > -0.3 ? yG : st.t > -0.52 ? yG * 0.5 + gy * 0.5 : gy;
      S.y = S.fresh === false ? S.y + (y - S.y) * Math.min(1, dt * 12) : y; S.fresh = false;
      S.inside = st.inside;
      S.inRoom = !!placeFigure(S.ch.group, x, S.y, z, S.h, st.inside);
      S.ch.update(dt, v);
    }
    (game.walkers = game.walkers || []).push(() => students);      // { x, z, vx, vz, y, hidden } in world coordinates: they open the doors as anybody does

    // (No bikes against the front: the houses stand straight on the pavement with no railings, and the photographs show
    // the bikes in the courtyard behind.) The generated bus shelter that stood across No. 7's door goes (the photograph
    // shows the stop's pole only); and nothing generated stands in the courtyard.
    try { world.clearArea([[17.4, -3.3], [21.0, -3.3], [21.0, -0.6], [17.4, -0.6]].map(([q, t]) => L2W(q, t)), { trees: false, lamps: false, furniture: true }); } catch (e) { console.warn('[beaumont] shelter', e); }
    try { world.clearArea(PL.COURT.map(([q, t]) => L2W(q, t)), { trees: true, lamps: true, furniture: true }); } catch (e) { console.warn('[beaumont] courtyard', e); }

    // ---------------------------------------------------------------- test hooks
    const C7 = L2W(21.3, 12);
    game.beaumont = {
      on: true, plan: PL, id: ROOM_ID, blockId: BLOCK_ID, group: grp, students, stats, zoneMat,
      get def() { return defP; }, get blockDef() { return defB; }, get room() { return RP; }, get block() { return RB; },
      get inner() { return RP ? RP.inner : null; }, get blockInner() { return RB ? RB.inner : null; },
      /** every door once its room is built: [{ ...plan data, door (core/_doors.js, ROOM coordinates), y, swingSign }] */
      get roomDoors() { return [...(RP ? RP.doors : []), ...(RB ? RB.doors : [])]; },
      get level() { return level; }, setLevel(v) { level = v ? 1 : 0; },
      get inside() { return inside(); }, get insideBlock() { return inBlock(); },
      get shown() { const S = slOf(defP); return !!(S && S.shown); }, get blockShown() { const S = slOf(defB); return !!(S && S.shown); },
      get go() { return go; }, get piano() { return piano; }, get session() { return session; }, playKeyboard,
      get bathLight() { return bathOn; }, set bathLight(v) { bathOn = !!v; light(); },
      /** a spot in the front frame on a storey ('pass' | 0 | 1) -> ROOM coordinates [x, y, z] */
      spot,
      /** the same spot in WORLD coordinates [x, y, z] */
      spotW: (s, t, lv = 0) => { const [x, z] = L2W(s, t); return [x, floorY(lv) + PAVE, z]; },
      light,
    };
    console.log(`[beaumont] 5-7 Beaumont Street built in ${stats.ms} ms: ${(extTris / 1000).toFixed(1)}k triangles outside; walk-in rooms '${ROOM_ID}' (the passage) and '${BLOCK_ID}' (the courtyard house)`);

    const api = {
      update(dt) {
        // the students come and go whether you are on the pavement or in the house
        const here_ = inside(), p = here_ ? P.worldPos : P.pos;
        const near = (here_ || P.place === 'world') && (p.x - C7[0]) ** 2 + (p.z - C7[1]) ** 2 < 140 * 140;
        for (const S of students) if (!S.broken && (near || S.shown)) studentTick(S, dt, near);
      },
    };
    game.beaumont.update = (dt) => api.update(dt);      // (tests step the house without the whole game loop)
    return api;
  },
};
