// The Ashmolean Museum, Beaumont Street (Cockerell, 1841-45; Rick Mather's extension 2009), c. 2013 — see
// docs/research/museums.md for what is known and what is guessed. The Randolph opposite is places/randolph.js and is
// not touched here.
//
//   preMap   the mapped outline (r1337584) loses the portico projection (built here instead) and has its two long
//            Beaumont Street edges split, so the world's own landmark portico (which it put on the 1939 west front)
//            is not drawn; the Grade I entrance screen (w134120760-3) becomes iron railings.
//   install  the portico (_mus_ash_front.js: four Ionic columns, pediment, Apollo, steps, forecourt banners) and, either
//            side of it, Cockerell's range as the photographs show it (one high window a bay) with the top of Mather's
//            building on the roof behind, drawn within 125 m (no budget view sees it from nearer, so no existing view
//            gets dearer); the museum itself as a WALK-IN building (docs/ARCHITECTURE.md "Walk-in interiors"; plan
//            _mus_ash_plan.js, room _mus_ash_interior.js + _mus_ash_atrium.js): up the steps, between the columns,
//            through the great doorway (the bronze leaves stand open by day) and the automatic doors of the glass
//            lobby into the hall; the atrium stair on foot to the first and second floors and the rooftop restaurant.
//            The podium and its steps are real ground (world.groundHeight is wrapped over them).
//   play     the museum trail (desk), the Alfred Jewel (look; try to take it: a pressure pad, the alarm, two stars and
//            an escort out on to Beaumont Street — the jewel never moves), "Please don't touch", a donation box, a
//            school party to guide round Egypt and the casts, coffee on the roof with the city through the glass.
//            Open 10:00-17:00 (in 2013: Tuesday to Sunday; the game's calendar has no weekdays); out of hours the
//            great doors are shut and the automatic doors locked ("Closed"); anyone inside at closing is shown out.
// Test hooks: game.ashmolean = { stats(), inside(), plan(), debugClimb(floor, walk), jewelThere(), alarm() }   tools/smoke_museums.mjs
import * as THREE from 'three';
import { frame, costOf } from './_mus_kit.js';
import { buildPortico, PORTICO } from './_mus_ash_front.js';
import { buildAshInterior, ASH_IN } from './_mus_ash_interior.js';
import { ATRIUM } from './_mus_ash_atrium.js';
import { makePlay, museumsApi, trailDesk } from './_mus_play.js';
import { isOpen, closedNotice, trailState, TRAIL, alarmHeat } from './_mus_logic.js';
import { randomLook } from '../core/characters.js';
import { AIR_FAR, airKeep } from './_se_fine.js';
import { planWalkin, streetDoor, cityDoor, warmLater } from './_walkin_city.js';
import { ASH_PLAN as PL, ASH_WINDOWS, ASH_RECTS, ASH_BOUNDS, ASH_ZONES, ASH_ROOF_GLASS, ashShell } from './_mus_ash_plan.js';

export const ASH_ID = 'mus_ash';
export const IDS = {
  ash: 'r1337584', screen: ['w134120760', 'w134120761', 'w134120762', 'w134120763'],
  // Ashmolean Cafe, Ashmolean Rooftop Restaurant (inside the museum), and a café the map puts 1.8 m off the museum's
  // street wing (a recent roastery: not there c. 2013 — a GUESS) which the world also gave to the museum's wall
  innerPois: ['n2430652627', 'n2430652628', 'n12015234669'],
  beaumont: ['r13335393', 'w318503697', 'w816331355', 'w816331356', 'w816331357', 'w816331358', 'w816331359', 'w816331360', 'w816331361', 'w816331362', 'w816331363',
    'w817703736', 'w817703737', 'w817703738', 'w817703739', 'w817703740', 'w817703741', 'w817703742', 'w817703743', 'w817703744', 'w817703745'],
};
// the portico frame: the middle of the mapped projection's front line, local +z = south (out to the forecourt)
export const FRAME = { ox: -4.85, oz: -39.85, th: 0.2289 };
const NEAR = 125;
const PROJ = [[-11.5, -38.3], [-6.4, -39.5], [1.8, -41.4]];
export const sights = [];

/** preMap edits of the outline (exported for the test) */
export function editOutline(b) {
  const near = (p, q) => Math.abs(p[0] - q[0]) < 0.06 && Math.abs(p[1] - q[1]) < 0.06;
  const before = b.poly.length;
  b.poly = b.poly.filter((p) => !PROJ.some((q) => near(p, q)));
  // split long south-facing edges on Beaumont Street
  const out = [];
  for (let i = 0; i < b.poly.length; i++) {
    const a = b.poly[i], c = b.poly[(i + 1) % b.poly.length]; out.push(a);
    const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (l > 12 && (a[1] + c[1]) / 2 > -20) { const n = Math.ceil(l / 11); for (let k = 1; k < n; k++) out.push([a[0] + ((c[0] - a[0]) * k) / n, a[1] + ((c[1] - a[1]) * k) / n]); }
  }
  b.poly = out;
  return b.poly.length - before;
}

export default {
  id: 'ashmolean',
  preMap(game) {
    try {
      const map = game.map, b = map.buildings.find((q) => q.id === IDS.ash);
      if (b && !b._musEdited) { editOutline(b); b._musEdited = true; }
      for (const id of IDS.screen) { const r = map.barriers.find((q) => q.id === id); if (r) { r.kind = 'railing'; r.h = 1.9; } }
      // photo comparison ("beaumont_east", "ashmolean"): the museum's café and rooftop restaurant POIs made the world plan
      // its Beaumont Street wing as a row of shopfronts with generic signs ("Delicatessen", "Coffee House"). They are
      // inside the museum (this module's interior has the café), so the world does not see them.
      for (const id of IDS.innerPois) game.overrides.skip.add(id);
      // the museum's flat roofs are lead and membrane, not clay tile (the roof only: its walls stay the landmark table's)
      if (!game.overrides.style.has(IDS.ash)) game.overrides.style.set(IDS.ash, { roof: 'lead' });
      // Beaumont Street's terraces are honey ashlar on both sides (the south side came out as grey render)
      for (const id of IDS.beaumont) if (!game.overrides.style.has(id)) game.overrides.style.set(id, { wall: 'stone', roof: 'slate', tint: [1.06, 0.97, 0.8] });
    } catch (e) { console.error('[ashmolean] preMap', e); }
  },

  install(game) {
    const W = game.world, F = frame(FRAME.ox, FRAME.oz, FRAME.th);
    const api = museumsApi(game);
    const S = { err: false, closeT: 0, near: true, alarmT: -1, alarms: 0, party: [] };
    // ---------------------------------------------------------------- the portico + podium collider + door
    const port = buildPortico({ game, frame: F });
    airKeep([port.meshes.stone, port.rangeMeshes && port.rangeMeshes.stone]);
    W.addStatic(port.group); if (port.range) W.addStatic(port.range);
    // the podium is real ground: its sides and what stands on it collide (columns, the porch's side walls), its steps
    // and floor are walked on (world.groundHeight below)
    {
      const C = game.worldCollider, P = PORTICO, sx = P.width / 2 + 0.9, z1 = 0.6 + P.steps * 0.36;
      for (const x of P.cols) { const c = F.w(x, P.colZ); C.addBox(c[0], c[1], 1.56, 1.56, FRAME.th); }
      for (const s of [-1, 1]) {
        const c = F.w(s * P.antaX, (P.wallZ + P.colZ + 0.2) / 2); C.addBox(c[0], c[1], 1.0, P.colZ + 0.2 - P.wallZ, FRAME.th);
        const a = F.w(s * sx, P.wallZ), b = F.w(s * sx, z1); C.addSegment(a[0], a[1], b[0], b[1]);
        // (the hand-built face of the range stands in front of the mapped wall: it is the wall you meet)
        const p = F.w(s * sx, PL.faceZ.w), q = F.w(s < 0 ? -21.65 : 23.63, PL.faceZ.w); C.addSegment(p[0], p[1], q[0], q[1]);
      }
      const g0 = W.groundHeight.bind(W), c = Math.cos(FRAME.th), sn = Math.sin(FRAME.th), top = P.podium, rise = top / P.steps, zt = 0.6 + 0.36;
      W.groundHeight = (x, z) => {
        const dx = x - FRAME.ox, dz = z - FRAME.oz;
        if (dx * dx + dz * dz < 150) {
          const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
          // (the podium and its steps; and the same floor through the thickness of the wall at the doorway)
          if (lz < z1 && ((Math.abs(lx) < sx && lz > P.wallZ - 0.05) || (Math.abs(lx) < PL.door.w / 2 + 0.15 && lz > PL.ZF - 1.8))) return lz <= zt ? top : Math.max(g0(x, z), top - rise * Math.ceil((lz - zt) / 0.36 - 1e-6));      // (absolute: the portico is built from y = 0)
        }
        return g0(x, z);
      };
    }
    for (const [x, z] of PORTICO.banners) { const p = F.w(x, z); game.worldCollider.addCircle(p[0], p[1], 0.12); }
    const doorW = F.w(0, 1.6);      // (the old prompt's place, kept for tools and for ?seamless=0: on the steps)
    const openNow = () => isOpen(ASH_ID, game.time.hour);
    const door = { pos: doorW, facing: F.h(0), radius: 2.4, label: 'Enter the Ashmolean', locked: () => (openNow() ? false : closedNotice(ASH_ID, game.time.hour)) };
    // Walk-in (core/interiors.js "seamless"; plan and fit: _walkin_city.js): the museum in place inside its mapped
    // outline (with the front where the hand-built faces stand), the room's coordinates = the portico frame.
    let plan = null;
    try {
      const b = game.map.buildings.find((q) => q.id === IDS.ash);
      if (b) {
        const A = ATRIUM, fx = (A.flights[0].x0 + A.flights[0].x1) / 2, ex = (A.flights[1].x0 + A.flights[1].x1) / 2, zs = A.south.z0 + 1.6, zn = A.north.z1 - 1.6, L = PL.LV;
        plan = planWalkin(game, {
          id: ASH_ID, building: ashShell(b.poly, F.l, F.w), door: { pos: F.w(0, -1.0), facing: F.h(0) }, wall: PL.door.depth,
          portal: { at: [0, PL.ZF], out: 0, w: PL.door.w, h: PL.door.h, y: 0 }, rects: ASH_RECTS, center: [0, -9],
          windows: [...ASH_WINDOWS.map((w) => ({ at: [w.x, PL.ZF], out: 0, w: PL.winW, y0: PL.winY0, y1: PL.winY1, depth: w.depth })), ...ASH_ROOF_GLASS],
          hours: { open: openNow, testShut: 3.5 }, mid: [0, -10.6],
          // the test's walk: up the three flights to the restaurant on the roof and down again
          tour: [[0, -17], [fx, zs], [fx, zn, L[1]], [ex, zn, L[1]], [ex, zs, L[2]], [0, zs + 1.5, L[2]], [fx, zs, L[2]], [fx, zn, L[3]], [3, PL.ZN + 5, L[3]], [PL.HW + 3.4, PL.ZN + 5, L[3]]],
        });
        plan.seamless.baseY = PL.PODIUM;      // room y = 0 is the top of the podium (the portico is built from y = 0)
        plan.seamless.bounds = ASH_BOUNDS; plan.seamless.zones = ASH_ZONES;
        streetDoor(game, plan, { every: 40, dwell: [25, 70] });      // (visitors off Beaumont Street)
      }
    } catch (e) { console.error('[ashmolean] plan', e); }

    // ---------------------------------------------------------------- the interior
    let ash = null, play = null, kids = [], teacher = null, great = null;
    const tour = { on: false, stop: 0, done: false };
    const STOPS = [
      { name: 'the Shrine of Taharqa', x: ASH_IN.shrine[0] + 2.8, z: ASH_IN.shrine[1], floor: 0, line: 'A whole temple! Can we go in? (No.)' },
      { name: 'the mummy case', x: ASH_IN.mummy[0], z: ASH_IN.mummy[1] + 1.7, floor: 0, line: 'Is there someone IN it?' },
      { name: 'the cast gallery', x: ASH_IN.casts[0], z: ASH_IN.casts[1] + 4.2, floor: 0, line: 'Why haven\'t they got any noses?' },
    ];
    function startTour() {
      if (tour.done) { game.ui.dialog('Teacher', ['You\'ve done more than enough. They\'re still talking about the noses.']); return; }
      if (tour.on) { game.ui.dialog('Teacher', [`Next stop: ${STOPS[tour.stop].name}. They\'re right behind you.`]); return; }
      tour.on = true; tour.stop = 0;
      game.ui.dialog('Teacher', ['Oh, would you? I\'ve left my notes on the coach.', 'Could you show them the Shrine of Taharqa, the mummy, and the casts? They\'ll follow you. Probably.']);
      game.ui.objective(`School party: lead the class to ${STOPS[0].name}`);
      const P = game.pedestrians; if (!P || !P.control) return;
      [teacher, ...kids].forEach((r, i) => {
        if (!r) return;
        P.control(r, (ped, dt) => {
          if (!tour.on) return false;
          const pl = game.player; if (pl.place !== ASH_ID) return true;
          const ang = pl.heading + Math.PI + (i - 3) * 0.32, gap = 1.6 + (i % 3) * 0.7;
          const tx = pl.pos.x + Math.sin(ang) * gap, tz = pl.pos.z + Math.cos(ang) * gap, d = Math.hypot(tx - ped.x, tz - ped.z);
          if (d < 0.25) { ped.speed = 0; return true; }
          const v = Math.min(2.4, d * 1.4), a = Math.atan2(tx - ped.x, tz - ped.z);
          ped.x += Math.sin(a) * v * dt; ped.z += Math.cos(a) * v * dt; ped.heading = a; ped.speed = v;
          return true;
        });
      });
    }
    function tourTick() {
      if (!tour.on || game.player.place !== ASH_ID || !ash || ash.floors.cur !== 0) return;
      const s = STOPS[tour.stop], pl = game.player.pos;
      if (Math.hypot(pl.x - s.x, pl.z - s.z) < 2.6) {
        const k = kids[tour.stop % Math.max(1, kids.length)]; if (k && k.character.say) k.character.say(s.line, 3);
        game.ui.toast(`A child: "${s.line}"`, 3);
        tour.stop++;
        if (tour.stop >= STOPS.length) {
          tour.on = false; tour.done = true; game.ui.objective(null); game.pay(6);
          game.ui.dialog('Teacher', ['Thank you so much! Everyone say thank you.', '"THANK YOU."', 'Here — £6 from the trip float. Don\'t tell the head.']);
          game.state.flags.ashTour = (game.state.flags.ashTour || 0) + 1; game.save && game.save();
        } else game.ui.objective(`School party: now ${STOPS[tour.stop].name}`);
      }
    }
    function alarm() {
      if (S.alarmT >= 0) return 'already';
      S.alarmT = 2.6; S.alarms++;
      game.ui.toast('You lift the glass a fraction… CLICK. The floor was a pressure pad. ALARM!', 3.5);
      const a = game.audio; if (a && a.ctx && a.tone) { for (let i = 0; i < 6; i++) setTimeout(() => { try { a.tone(i % 2 ? 1250 : 980, 0.22, { gain: 0.25 }); } catch { /* */ } }, i * 260); }
      if (game.police && game.police.add) game.police.add('museum_alarm', alarmHeat(game.police.heat), 1);
      for (const st of (play && play.state.staff) || []) if (st.ped && st.ped.character.say && st.floor === ash.floors.cur) st.ped.character.say('OI!', 2);
      game.state.flags.ashAlarms = (game.state.flags.ashAlarms || 0) + 1; game.save && game.save();
      return 'alarm';
    }
    // the museum's light by the hour (open: lit; shut: daylight through the roof, or a watchman's glimmer), its people
    // (there whenever the building is shown and open: seen from the forecourt through the doorway), the great doors
    const shownTick = (dt) => {
      if (!ash) return;
      const open = openNow(), day = game.time.daylight ?? 1;
      if (ash.setLight && (S.lOpen !== open || Math.abs((S.lDay ?? -1) - day) > 0.02)) {
        // (when the lights go on or off, the picture of the room that is shown from further off is taken again now, not
        //  at its next turn: core/_roomview.js — a no-op if the core has no such picture)
        if (S.lOpen !== undefined && S.lOpen !== open) { const sl = game.interiors.get(ASH_ID).sl; if (sl && typeof sl.impAge === 'number') { sl.impAge = 1e3; sl.impSeen = true; } S.leafT = 1.4; }
        S.lOpen = open; S.lDay = day; ash.setLight(open ? 1 : 0.07, day);
      }
      if (S.leafT > 0 && (S.leafT -= dt) <= 0) { const sl = game.interiors.get(ASH_ID).sl; if (sl && typeof sl.impAge === 'number') { sl.impAge = 1e3; sl.impSeen = true; } }      // (and once the great doors have swung)
      if (great) { const t = open ? 1 : 0; if (great.t !== t) { great.t += Math.sign(t - great.t) * Math.min(Math.abs(t - great.t), dt * 0.9); const e = great.t * great.t * (3 - 2 * great.t); great.leaves[0].rotation.y = -e * Math.PI / 2; great.leaves[1].rotation.y = e * Math.PI / 2; } }
      if (play && S.pOpen !== open) { S.pOpen = open; for (const r of [...play.state.staff, ...play.state.peds, ...S.party]) if (r && r.ped && r.ped.character) r.ped.character.group.visible = open; }
    };
    game.interiors.register({
      id: ASH_ID, name: 'Ashmolean Museum', doors: [door], background: 0xdad6cc, ambient: 0.42,
      seamless: plan && plan.fit.ok ? plan.seamless : null,
      *build(ctx) {      // (in pieces: core/interiors.js `*build`)
        const SL = !!(ctx.seamless && plan);
        ash = yield* buildAshInterior(ctx, game);
        yield;
        if (SL) {
          // the automatic glass doors in the lobby's inner face (they are the street door: shut = the doorway is a wall;
          // locked out of hours), and the great bronze leaves in the doorway itself, folded back by day
          const pt = ctx.seamless.portals[0], lob = ash.lobby;
          const ctx2 = { seamless: { portals: [{ ...pt, w: lob.doorW, h: lob.doorH }] }, addDoor: (o) => ctx.addDoor({ ...o, colliders: [ash.colliders[0]], block: [-lob.doorW / 2, lob.z, lob.doorW / 2, lob.z] }) };
          ash.door = cityDoor(ctx2, plan, { kind: 'slide', setBack: lob.z - PL.ZF, open: plan.hours.open, rangeOut: 5.4, rangeIn: 2.4 });
          const mat = new THREE.MeshStandardMaterial({ color: 0x2f3b33, roughness: 0.55, metalness: 0.35, name: 'mus-ash-greatdoor' }), stud = new THREE.MeshStandardMaterial({ color: 0x9a8a50, roughness: 0.4, metalness: 0.7, name: 'mus-ash-greatdoor-stud' });
          const hw = PL.door.w / 2, zh = PL.ZF + PL.door.depth - 0.1, leaves = [];
          for (const s of [1, -1]) {
            const g = new THREE.Group(); g.name = 'mus-ash:great-leaf'; g.position.set(s * (hw - 0.06), 0, zh);
            const m = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.07, PL.door.h - 0.02, 0.09), mat); m.position.set(-s * (hw - 0.07) / 2, PL.door.h / 2, 0); m.userData.noSplit = true; m.userData.live = true; g.add(m);
            for (let j = 0; j < 3; j++) { const p = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.4, PL.door.h / 3 - 0.45, 0.13), mat); p.position.set(-s * hw / 2, (j + 0.5) * PL.door.h / 3, 0); p.userData.noSplit = true; p.userData.live = true; g.add(p); const k = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), stud); k.position.set(-s * hw / 2, (j + 0.5) * PL.door.h / 3, 0.08); k.userData.noSplit = true; k.userData.live = true; g.add(k); }
            ctx.scene.add(g); leaves.push(g);
          }
          great = { leaves, t: openNow() ? 1 : 0 }; leaves[0].rotation.y = -great.t * Math.PI / 2; leaves[1].rotation.y = great.t * Math.PI / 2;
        } else game.interact.add({ place: ctx.id, pos: [ASH_IN.exit[0], 0.1, ASH_IN.exit[1]], radius: 1.6, label: 'Leave the Ashmolean', onUse: () => game.interiors.exit() });   // ground floor only (a 3D pos)
        play = makePlay(game, ctx, { id: ASH_ID, floors: ash.floors, touch: ash.touch, staff: ash.staff, visitors: ash.visitors, exhibits: ash.exhibits,
          donate: { x: ASH_IN.donate[0], z: ASH_IN.donate[1] + 0.6, floor: 0, thanks: ['Thank you! Admission stays free.', 'Thank you — that\'s a new nose for a cast.', 'Thanks! The Alfred Jewel nods at you. (It doesn\'t.)'] } });
        const L = ash.floors.levels;
        game.interact.add({ place: ASH_ID, pos: [ASH_IN.desk[0], 0.1, ASH_IN.desk[1] + 1.0], radius: 1.7, label: () => { const t = trailState(game.state.flags); return !t.has ? 'Pick up a museum trail leaflet' : !t.done && t.found.length >= TRAIL.length ? 'Hand in your trail leaflet' : 'Ask about the museum trail'; }, onUse: () => trailDesk(game) });
        game.interact.add({ place: ASH_ID, pos: [ASH_IN.jewel[0] - 1.0, L[ASH_IN.jewelFloor] + 0.1, ASH_IN.jewel[1]], radius: 1.4, label: 'Take the Alfred Jewel', enabled: () => S.alarmT < 0, onUse: alarm });
        game.interact.add({ place: ASH_ID, pos: [ASH_IN.coffee[0] + 1.0, L[3] + 0.1, ASH_IN.coffee[1]], radius: 1.6, label: 'Order a coffee and a scone (£4.50)',
          onUse: () => { if (!game.pay(-4.5)) { game.ui.toast('£4.50. You have £' + game.state.money.toFixed(2) + '.', 3); return; } const f = game.state.flags; f.energy = Math.min(100, (f.energy || 0) + 25); game.save && game.save(); game.ui.toast('Coffee, a scone and the rooftops through the glass. Civilised.', 3.5); } });
        // the school party in Egypt (a teacher and six children)
        if (game.pedestrians) {
          const [tx, tz] = ASH_IN.teacher;
          try { teacher = game.pedestrians.spawnAt(tx, tz, randomLook('ash-teacher', { outfit: 'smart' }), { place: ASH_ID, scene: ctx.scene, heading: Math.PI / 2, knockable: false, label: 'Teacher', lines: ['Stay together, please!', 'Jayden, that is a coffin, not a climbing frame.'] }); } catch (e) { console.warn('[ashmolean] teacher', e); }
          for (let i = 0; i < 6; i++) {
            const L0 = randomLook('ash-kid-' + i, { outfit: 'casual' });
            const look = { ...L0, height: 1.22 + (i % 3) * 0.06, jacket: 0x1e2a6a, jacketLen: 'short', top: 0x1e2a6a, shirt: 0xf0f0f0, bottom: 0x3a3a3a, hat: null, gown: null, prop: null, backpack: i % 2 ? L0.backpack || 'small' : null };
            const a = (i / 6) * Math.PI * 1.3 - 0.4;
            try { kids.push(game.pedestrians.spawnAt(tx + 1.6 + Math.cos(a) * 1.3, tz + Math.sin(a) * 1.3, look, { place: ASH_ID, scene: ctx.scene, heading: -Math.PI / 2 + a * 0.3, knockable: false, lines: ['Miss, I need the toilet.', 'Is this real gold?', 'I\'m bored. Can we see the mummy again?'] })); } catch (e) { console.warn('[ashmolean] kid', e); }
          }
          game.interact.add({ place: ASH_ID, pos: () => (teacher ? (S.tp = S.tp || new THREE.Vector3()).set(teacher.x, 0, teacher.z) : new THREE.Vector3(1e6, 0, 1e6)), radius: 1.7, label: () => (tour.on ? 'Talk to the teacher' : tour.done ? 'Talk to the teacher' : 'Talk to the teacher (school party)'), onUse: startTour });
        }
        // people upstairs stand on their own floors from the first frame the building is shown (their floor is only
        // known to the pedestrians while you are inside: _mus_play.js holds them there then)
        S.party = [teacher, ...kids].filter(Boolean).map((ped) => ({ ped }));
        for (const r of play.state.held) if (r.ped) { r.ped.y = r.ped.gy = r.y; r.ped.character.group.position.y = r.y; }
        S.lOpen = S.pOpen = undefined; shownTick(0);
        return { spawn: ASH_IN.spawn, heading: Math.PI };
      },
      onEnter() { if (ash) { ash.floors.set(0); game.player.pos.y = game.groundHeight(game.player.pos.x, game.player.pos.z); } },
      update(dt) { try { play && play.update(dt); tourTick(); shownTick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[ashmolean] interior', e); } } },
      updateShown(dt) { shownTick(dt); },
    });
    if (plan && plan.fit.ok) warmLater(game, ASH_ID, { heavy: true });      // (four floors: built on the loading screen, not on the walk across the forecourt)
    api.register(ASH_ID, { door, floors: () => ash && ash.floors, looks: {} });

    // ---------------------------------------------------------------- sights
    const w0 = F.w(0, 0);
    sights.length = 0;
    sights.push(
      { id: 'ash-portico', name: 'The Ashmolean', x: w0[0], z: w0[1], blurb: 'Cockerell\'s Greek temple front of 1841-45, Ionic columns after the Temple of Apollo at Bassae; Britain\'s first public museum (1683), here since 1845.' },
      { id: 'ash-apollo', name: 'Apollo on the pediment', x: w0[0], z: w0[1] - 1, blurb: 'Apollo presides over the portico, as he did at Bassae.' },
      { id: 'ash-atrium', name: 'The atrium stair', x: F.w(0, -30)[0], z: F.w(0, -30)[1], blurb: 'Rick Mather\'s 2009 top-lit atrium: flights of stairs crossing a white well through five floors.' },
      { id: 'ash-jewel', name: 'The Alfred Jewel', x: F.w(...ASH_IN.jewel)[0], z: F.w(...ASH_IN.jewel)[1], blurb: '"Alfred ordered me to be made": gold, crystal and enamel, c. 880. Look, do not take.' },
      { id: 'ash-shrine', name: 'Shrine of Taharqa', x: F.w(...ASH_IN.shrine)[0], z: F.w(...ASH_IN.shrine)[1], blurb: 'A Nubian temple shrine of c. 680 BC, rebuilt stone by stone in the Egypt galleries.' },
      { id: 'ash-casts', name: 'The Cast Gallery', x: F.w(...ASH_IN.casts)[0], z: F.w(...ASH_IN.casts)[1], blurb: 'Plaster casts of Greek and Roman sculpture: drawing practice without the trip to Athens.' },
      { id: 'ash-roof', name: 'Ashmolean rooftop restaurant', x: F.w(12, -38)[0], z: F.w(12, -38)[1], blurb: 'The restaurant on the roof of Rick Mather\'s building: the Randolph and St Giles\' through the glass.' },
    );
    for (const s of sights) api.sights.push(s);

    // ---------------------------------------------------------------- per frame
    let ejecting = false;
    function tick(dt) {
      // the portico: drawn near only (no budget view is within 125 m)
      // (and from inside the museum: the columns are what is seen through the doorway — game.eye is the eye in the world)
      const cam = game.eye || game.camera.position, out = game.player.place === 'world' || game.player.place === ASH_ID;
      // (from a glider, W.aerial: kept on out to AIR_FAR; the banners only near, see airKeep after the build)
      const dp = Math.hypot(cam.x - FRAME.ox, cam.z - FRAME.oz), near = out && (dp < NEAR || (!!W.aerial && dp < AIR_FAR));
      if (near !== S.near) { S.near = near; port.group.visible = near; if (port.range) port.range.visible = near; }
      if (port.meshes.banner) { const b = out && dp < NEAR; if (port.meshes.banner.visible !== b) port.meshes.banner.visible = b; }
      // the alarm: shown out
      if (S.alarmT >= 0 && (S.alarmT -= dt) < 0) {
        S.alarmT = -1;
        if (game.player.place === ASH_ID && !ejecting) {
          ejecting = true; if (game.activity) game.endActivity();
          api.eject().then(() => game.ui.toast('Two attendants walk you firmly out on to Beaumont Street. The Alfred Jewel has not moved a millimetre.', 4.5)).finally(() => { ejecting = false; });
        }
      }
      if ((S.closeT -= dt) <= 0) {
        S.closeT = 1;
        if (game.player.place === ASH_ID && !isOpen(ASH_ID, game.time.hour) && !ejecting) {
          ejecting = true; if (game.activity) game.endActivity();
          game.ui.toast('Closing time. The attendants sweep everyone gently down the stairs and out under the portico.', 4);
          api.eject().finally(() => { ejecting = false; });
        }
      }
    }
    game.ashmolean = {
      portico: port, frame: F, inside: () => ash, play: () => play, tour, plan: () => plan, jewelFloor: ASH_IN.jewelFloor,
      debug: () => ({ hour: game.time.hour, open: openNow(), lit: S.lOpen, day: S.lDay, leaves: great && +great.t.toFixed(2), people: S.pOpen }),
      jewelThere: () => true,   // it never moves
      alarm,
      stats() { const o = { portico: costOf(port.group), near: S.near, alarms: S.alarms }; if (ash) o.interior = costOf(game.interiors.get(ASH_ID).scene); return o; },
      /** walk the atrium stair from the current floor to floor k (tests): uses walk(points) */
      debugClimb(k, walk) {
        const Fl = ash.floors, A = ATRIUM, fl = A.flights;
        const goUp = (b) => { const f = fl[b], x = (f.x0 + f.x1) / 2, north = f.lo === f.z1; const zs = north ? [f.z1 + 1.2, f.z0 - 1.6] : [f.z0 - 1.2, f.z1 + 1.6]; game.player.teleport(x, zs[0], 0); walk([[x, zs[0]], [x, zs[1]]]); };
        const goDown = (b) => { const f = fl[b], x = (f.x0 + f.x1) / 2, north = f.lo === f.z1; const zs = north ? [f.z0 - 1.2, f.z1 + 1.6] : [f.z1 + 1.2, f.z0 - 1.6]; game.player.teleport(x, zs[0], 0); walk([[x, zs[0]], [x, zs[1]]]); };
        while (Fl.cur < k) goUp(Fl.cur);
        while (Fl.cur > k) goDown(Fl.cur - 1);
        return Fl.cur;
      },
    };
    tick(0);
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[ashmolean]', e); } } } };
  },
};
