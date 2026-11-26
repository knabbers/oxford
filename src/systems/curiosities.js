// Curiosities: forty small things to stumble on round the city (systems/_curio_list.js), rewarding exploring without a
// map. Each is found by getting close, looking at it, pressing E on it, sitting on it or climbing to it — some only
// from a bicycle or a boat, some only at night, in rain, fog or frost, or at a certain hour. Finding one shows its line,
// pays a pound or two and adds to a tally ("Curiosities found: 7", also at the foot of the passport page on P) that
// never names or places the ones still to find. Saved in localStorage['gto-curios']; nothing on the network: each
// player finds their own.
//
// Props (plaques, a tortoise, a cat on a wall, herons, a tin, a rope swing, a gate, a pig on a tower, a busker's hat, a
// painted cabinet, a bicycle with a tree through it): ONE merged mesh in the batch-4 atlas material (no new shader),
// built once on the first frame (when every place module's colliders exist), drawn only while the camera is within
// 80 m of one of them. The busker is a character, made only while you are near and he is playing.
//
// Test hooks: game.curiosities = { count, isFound(id), stats(), check(), reset(), debugFind(id) }   tools/smoke_todo.mjs
import * as THREE from 'three';
import { b4Pack, geoOf, RB, frame, bike } from '../places/_b4_kit.js';
import { createCharacter, randomLook } from '../core/characters.js';
import { CURIOS } from './_curio_list.js';

const KEY = 'gto-curios', SHOW = 80, CHECK = 0.2;
const TAU = Math.PI * 2;
const _dir = new THREE.Vector3();

/** is the curio's condition met now? (pure on its inputs: hour, isNight, weather state) */
export function conditionMet(c, hour, isNight, W) {
  const w = c.when; if (!w) return true;
  if (w.hours) { const [a, b] = w.hours; if (!(a < b ? hour >= a && hour < b : hour >= a || hour < b)) return false; }
  if (w.night && !isNight) return false;
  const st = (W && W.state) || '';
  if (w.clearNight && !(isNight && (!W || ((W.cloud ?? 0) < 0.55 && !(W.rain > 0.05) && !(W.fog > 0.3))))) return false;
  if (w.rain && !(W && (W.rain > 0.2 || /rain|drizzle|shower|thunder/.test(st)))) return false;
  if (w.fog && !(W && (W.fog > 0.3 || /fog|mist/.test(st)))) return false;
  if (w.cold && !(W && (W.frost > 0.2 || W.snow > 0.05 || /frost|snow/.test(st)))) return false;
  return true;
}
/** the tally line: how many, never which */
export const tallyText = (n) => (n ? `Curiosities found: ${n}` : 'Curiosities found: none yet. Keep your eyes open.');

export default {
  id: 'curiosities',
  install(game) {
    const S = { err: false, built: false, t: 0, mesh: null, busker: null, sitting: null, swinging: false, finds: 0, passportShown: false, gnd: new Map() };
    let found = new Set();
    try { const j = JSON.parse(globalThis.localStorage.getItem(KEY) || '{}'); if (Array.isArray(j.found)) found = new Set(j.found.filter((id) => CURIOS.some((c) => c.id === id))); } catch { /* blocked / node */ }
    const save = () => { try { globalThis.localStorage.setItem(KEY, JSON.stringify({ found: [...found] })); } catch { /* */ } };
    const toast = (t, s = 6) => { try { game.ui.toast(t, s); } catch { /* */ } };
    const byId = new Map(CURIOS.map((c) => [c.id, c]));
    const gy = (x, z) => { const k = x * 7.31 + z; let v = S.gnd.get(k); if (v === undefined) { v = game.world && game.world.groundHeight ? game.world.groundHeight(x, z) : 0; S.gnd.set(k, v); } return v; };
    const spots = new Map();          // id -> {x, z} where the player stands to use it (snapped once on the first frame)

    function chime() { /* (silent since 2026-11-23: it was a three-note chime, a game's sound, not the place's) */ }
    function find(c, quiet = false) {
      if (found.has(c.id)) return false;
      found.add(c.id); save(); S.finds++;
      if (c.pay) game.pay(c.pay);
      if (!quiet) { toast(`${c.text}  (${tallyText(found.size)}${c.pay ? ` · +£${c.pay}` : ''})`, 8); chime(); }
      return true;
    }

    // ---------------------------------------------------------------- props: one merged draw
    function nearFree(x, z, maxR, test) {
      if (test(x, z)) return [x, z];
      for (let r = 0.4; r <= maxR; r += 0.4) for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; if (test(px, pz)) return [px, pz]; }
      return null;
    }
    function buildProps() {
      const col = game.worldCollider, B = new RB();
      const dry = (x, z) => col.isFree(x, z, 0.35) && !col.isWet(x, z);
      for (const c of CURIOS) {
        const x = c.x, z = c.z, g = gy(x, z);
        switch (c.prop) {
          case 'plaque': {      // a round blue plaque on the wall: white rim, blue disc (unreadable from here: read the toast)
            const f = c.face || 0;
            // (pier: the plaque is on a stone gate pier of its own - where the wall it is on in life is only a hedge here -
            // its face flush with the plaque's wall point, solid to walkers)
            if (c.pier) {
              const nx = Math.sin(f), nz = Math.cos(f), [pw, ph] = c.pier, cx = x - nx * pw / 2, cz = z - nz * pw / 2;
              B.push(frame(cx, g, cz, Math.cos(f), -Math.sin(f))); B.box('stone', 0, ph / 2, 0, pw, ph, pw, 0); B.box('stone', 0, ph + 0.06, 0, pw + 0.12, 0.12, pw + 0.12, 0); B.box('stone', 0, ph + 0.2, 0, pw * 0.5, 0.16, pw * 0.5, 0); B.pop();
              try { col.addBox(cx, cz, pw, pw, f); } catch { /* */ }
            }
            // (terrain: on a building that stands level on a slope the plaque keeps its place on the wall - world.terrainStand)
            B.push(frame(x, c.y + (!c.pier && game.world && game.world.terrainStand ? game.world.terrainStand(x, z) : 0), z, Math.cos(f), -Math.sin(f)));
            const ring = (r, d) => Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * TAU; return [Math.cos(a) * r, Math.sin(a) * r, d]; });
            B.poly('white', ring(0.33, 0.015), [0, 0, 1]); B.poly('steamerBlue', ring(0.29, 0.03), [0, 0, 1]);
            B.box('white', 0, 0.06, 0.035, 0.34, 0.03, 0.005, 0); B.box('white', 0, -0.05, 0.035, 0.26, 0.025, 0.005, 0);
            B.pop(); break;
          }
          case 'door': {        // a small arched gate in the wall, painted green
            const f = c.face || 0; B.push(frame(x, g, z, Math.cos(f), -Math.sin(f)));
            B.box('green', 0, 0.95, 0.03, 0.95, 1.9, 0.06, 0); B.box('oak', 0, 1.92, 0.04, 1.1, 0.1, 0.08, 0);
            B.box('gold', 0.34, 0.95, 0.07, 0.05, 0.05, 0.04, 0);
            B.pop(); break;
          }
          case 'tortoise': {
            B.cyl('oak', x, g + 0.02, z, 0.17, 0.1, 9, true, 0.08); B.box('green', x, g + 0.05, z + 0.21, 0.07, 0.06, 0.1, 0);
            for (const [dx, dz] of [[0.12, 0.1], [-0.12, 0.1], [0.12, -0.1], [-0.12, -0.1]]) B.box('green', x + dx, g + 0.02, z + dz, 0.05, 0.04, 0.05, 0);
            break;
          }
          case 'cat': {         // asleep on the wall top, curled
            const y = c.y; B.cyl('dark', x, y, z, 0.24, 0.17, 8, true, 0.17); B.box('dark', x + 0.2, y + 0.14, z - 0.06, 0.16, 0.14, 0.14, 0.4);
            B.box('dark', x + 0.23, y + 0.24, z - 0.1, 0.04, 0.07, 0.04, 0); B.box('dark', x + 0.23, y + 0.24, z - 0.01, 0.04, 0.07, 0.04, 0);
            B.beam('dark', [x - 0.21, y + 0.07, z], [x - 0.07, y + 0.06, z + 0.28], 0.05); break;
          }
          case 'heron': {       // grey, on stilts, pretending to be a post (in the shallows at the bank)
            const yb = Math.max(g, 0.03);
            for (const s of [-0.05, 0.05]) B.beam('statueDk', [x + s, yb, z], [x + s * 0.4, yb + 0.55, z], 0.02);
            B.box('concrete', x, yb + 0.68, z, 0.16, 0.22, 0.4, 0.3); B.beam('concrete', [x, yb + 0.75, z + 0.16], [x, yb + 1.05, z + 0.12], 0.05);
            B.box('white', x, yb + 1.08, z + 0.13, 0.07, 0.07, 0.1, 0); B.beam('gold', [x, yb + 1.08, z + 0.18], [x, yb + 1.05, z + 0.33], 0.025);
            break;
          }
          case 'tin': B.cyl('steamerRed', x, g, z, 0.09, 0.09, 8, true); B.cyl('gold', x, g + 0.09, z, 0.092, 0.012, 8, true); break;
          case 'pig': {         // a carved head on the tower's face: unmistakably a pig
            const f = c.face || 0; B.push(frame(x, c.y, z, Math.cos(f), -Math.sin(f)));
            B.box('statue', 0, 0, 0.32, 0.85, 0.8, 0.66, 0); B.box('statue', 0, -0.1, 0.78, 0.44, 0.34, 0.3, 0);
            B.box('statueDk', -0.1, -0.1, 0.935, 0.08, 0.1, 0.02, 0); B.box('statueDk', 0.1, -0.1, 0.935, 0.08, 0.1, 0.02, 0);
            for (const s of [-1, 1]) { B.box('statue', s * 0.3, 0.5, 0.3, 0.24, 0.3, 0.1, s * 0.3); B.box('statueDk', s * 0.2, 0.16, 0.66, 0.1, 0.1, 0.02, 0); }
            B.pop(); break;
          }
          case 'busker': B.cyl('dark', x + 0.7, g, z + 0.4, 0.17, 0.07, 9, false, 0.15); for (let k = 0; k < 4; k++) B.cyl('gold', x + 0.66 + k * 0.03, g + 0.02, z + 0.38 + (k % 2) * 0.05, 0.012, 0.004, 6, true); break;
          case 'foxbox': {
            B.box('green', x, g + 0.62, z, 0.85, 1.24, 0.42, 0.3);
            const f = 0.3, ux = Math.cos(f), uz = -Math.sin(f), nx = Math.sin(f), nz = Math.cos(f), P = (a, b) => [x + ux * a + nx * 0.215, g + b, z + uz * a + nz * 0.215];
            B.poly('steamerRed', [P(-0.25, 0.35), P(0.25, 0.35), P(0.0, 0.95)], [nx, 0, nz]); B.poly('white', [P(-0.06, 0.4), P(0.06, 0.4), P(0, 0.55)], [nx, 0, nz]);
            B.poly('steamerRed', [P(-0.22, 0.85), P(-0.1, 0.85), P(-0.17, 1.05)], [nx, 0, nz]); B.poly('steamerRed', [P(0.1, 0.85), P(0.22, 0.85), P(0.17, 1.05)], [nx, 0, nz]);
            B.box('steamerBlue', x + nx * 0.22, g + 0.62, z + nz * 0.22, 0.4, 0.06, 0.01, f); break;
          }
          case 'treebike': {
            bike(B, x, z, 0.5, 'navy', 0);
            const tx = x - Math.sin(0.5) * 0.45, tz = z - Math.cos(0.5) * 0.45;
            B.beam('oak', [tx, g, tz], [tx + 0.05, g + 1.9, tz], 0.06); B.box('foliage', tx + 0.05, g + 2.2, tz, 0.9, 0.8, 0.9, 0.4); break;
          }
          case 'rope': {        // a rope from a branch out over the water, a stick for a seat
            const bank = nearFree(x, z, 8, dry) || [x, z];
            spots.set(c.id, { x: bank[0], z: bank[1] });
            let dx = x - bank[0], dz = z - bank[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
            const px = bank[0] + dx * 1.9, pz = bank[1] + dz * 1.9; spots.get(c.id).pivot = [px, pz, dx, dz];
            B.beam('oak', [bank[0] - dx * 1.2, g + 2.0, bank[1] - dz * 1.2], [px + dx * 0.6, 4.6, pz + dz * 0.6], 0.16, 0.14);
            B.beam('oak', [bank[0] - dx * 1.4, g, bank[1] - dz * 1.4], [bank[0] - dx * 1.2, g + 2.1, bank[1] - dz * 1.2], 0.3);
            B.beam('rope', [px, 4.5, pz], [bank[0] + dx * 0.4, g + 1.0, bank[1] + dz * 0.4], 0.03); if (dx || dz) B.beam('oak', [bank[0] + dx * 0.4 - dz * 0.25, g + 1.0, bank[1] + dz * 0.4 + dx * 0.25], [bank[0] + dx * 0.4 + dz * 0.25, g + 1.0, bank[1] + dz * 0.4 - dx * 0.25], 0.05);   // (no bank found — a cropped test city has no river here: no seat, a beam of no length is NaN)
            break;
          }
          default: break;
        }
      }
      const pack = b4Pack(game.world), geo = geoOf(B, pack);
      if (geo) {
        geo.userData.terrainStood = true;      // (terrain: its plaques took their walls' levels as they were built, above; the draping pass must not add them again)
        S.mesh = new THREE.Mesh(geo, pack.atlas); S.mesh.name = 'curiosities'; S.mesh.castShadow = true; S.mesh.receiveShadow = true; S.mesh.visible = false;
        S.mesh.frustumCulled = false; game.worldScene.add(S.mesh); S.tris = geo.attributes.position.count / 3;
      }
    }

    // ---------------------------------------------------------------- sitting, the swing, using things
    function sit(c) {
      const p = game.player; if (p.vehicle || game.activity) return;
      // the drawn bench (world furniture: its position and the way it faces), else the mapped point
      let bx = c.x, bz = c.z, h = 0, best = 3;
      try {
        const B = game.world.furniture && game.world.furniture.sets && game.world.furniture.sets.bench;
        if (B) for (let i = 0; i < B.n; i++) { const x = B.xz[i * 2], z = B.xz[i * 2 + 1], d = Math.hypot(x - c.x, z - c.z); if (d < best) { best = d; bx = x; bz = z; const o = i * 16; h = Math.atan2(B.mat[o + 8], B.mat[o]); } }
      } catch { /* */ }
      const col = game.worldCollider, fx = Math.sin(h), fz = Math.cos(h);
      const spot = nearFree(bx + fx * 0.9, bz + fz * 0.9, 1.6, (x, z) => col.isFree(x, z, 0.3) && !col.isWet(x, z)) || [bx + fx * 0.9, bz + fz * 0.9];
      p.pos.set(bx + fx * 0.06, gy(bx, bz), bz + fz * 0.06); p.heading = h; p.pose = 'sit'; try { p.character.setPose('sit'); } catch { /* */ }
      if (p.syncMesh) p.syncMesh();
      let t = 0; S.sitting = c;
      game.beginActivity({ name: 'curio-sit', pointer: 'locked', hint: 'Sitting on the bench. E or Esc to get up.',
        update(dt) { t += dt; if (t > 0.4 && game.input.hit('KeyE')) { game.input.pressed.delete('KeyE'); game.endActivity(); } },
        onKey(code) { if (code === 'KeyE' && t > 0.4) { game.input.pressed.delete('KeyE'); game.endActivity(); } },
        onEnd() { S.sitting = null; p.pose = 'stand'; try { p.character.setPose('stand'); } catch { /* */ } p.pos.set(spot[0], gy(spot[0], spot[1]), spot[1]); if (p.syncMesh) p.syncMesh(); } });
      if (!find(c)) toast(c.text, 7);
    }
    function swing(c) {
      const p = game.player, sp = spots.get(c.id); if (p.vehicle || game.activity || !sp || !sp.pivot) return;
      const [px, pz, dx, dz] = sp.pivot, L = 3.6, top = 4.5; let t = 0; S.swinging = true;
      p.character.group.visible = false;
      game.beginActivity({ name: 'curio-swing', pointer: 'free',
        update(dt) { t += dt; if (t > 5.2) game.endActivity(); },
        camera(dt, cam) {
          const a = -0.85 * Math.cos(t * TAU / 2.6) * Math.max(0, 1 - t / 6);      // out over the water and back (radians from vertical)
          const ox = Math.sin(a) * L, oy = -Math.cos(a) * L;
          cam.position.set(px + dx * ox, top + oy + 1.5, pz + dz * ox);
          cam.lookAt(px + dx * (ox + 6), top + oy + 0.6 - Math.sin(a) * 2, pz + dz * (ox + 6));
        },
        onEnd() { S.swinging = false; p.character.group.visible = true; } });
      if (!find(c)) toast('Out over the water... and back. Still fun.', 3);
    }
    function use(c) {
      const now = game.time.hour;
      if (!conditionMet(c, now, game.time.isNight, game.weather)) { toast(c.locked || 'Nothing there. Just now, anyway.', 4); return; }
      if (c.swing) return swing(c);
      if (!find(c)) toast(c.id === 'geocache' ? 'The tin behind the bench. Your name is in the book already.' : c.text, 4);
    }
    function addInteracts() {
      for (const c of CURIOS) {
        if (c.how !== 'use' && c.how !== 'sit') continue;
        // (a bench's own point is the bench: given as a function so the placement audit does not read it as a doorway)
        const sp = spots.get(c.id), v = new THREE.Vector3(sp ? sp.x : c.x, 0, sp ? sp.z : c.z), pos = c.how === 'sit' ? () => { v.y = game.player.pos.y; return v; } : [v.x, v.z];
        try { game.interact.add({ pos, radius: c.r || 2.2, label: c.label || 'Look', enabled: () => !game.player.vehicle && !game.activity, onUse: () => (c.how === 'sit' ? sit(c) : use(c)) }); } catch (e) { console.warn('[curiosities] interact', e); }
      }
    }

    // ---------------------------------------------------------------- the busker (a character only near, by day)
    function tickBusker(dt) {
      const c = byId.get('busker'), p = game.player; if (!c) return;
      // (there from further off than a figure is drawn, fading in with the distance as the walkers do - he used to
      //  appear at 55 m in plain view; when his hours or the weather end he goes while nobody is looking)
      const d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z), ok = conditionMet(c, game.time.hour, game.time.isNight, game.weather), PD = game.pedestrians;
      const on = p.place === 'world' && d < 152 && (ok || (!!S.busker && d < 145 && !!PD && !!PD.unseen && !PD.unseen(c.x, c.z)));
      if (on && !S.busker) { try { S.busker = createCharacter(randomLook('busker-cornmarket', { outfit: 'casual' })); S.busker.setPose('clap'); S.busker.group.position.set(c.x, gy(c.x, c.z), c.z); S.busker.group.rotation.y = 1.0; game.worldScene.add(S.busker.group); } catch (e) { S.busker = { fake: true }; } }
      else if (!on && S.busker && !S.busker.fake) { S.busker.group.removeFromParent(); try { S.busker.dispose && S.busker.dispose(); } catch { /* */ } S.busker = null; }
      if (S.busker && !S.busker.fake) { const al = d >= 145 ? 0 : d > 128 ? (145 - d) / 17 : 1, g0 = S.busker.group; g0.visible = al > 0.03; if (g0.visible) { if (S.busker.setFade) S.busker.setFade(al); S.busker.update(dt, 0); } }
    }

    // ---------------------------------------------------------------- finding
    function boating() { const v = game.player.vehicle; return !!((v && (v.kind === 'punt' || v.kind === 'rowboat')) || (game.steamer && game.steamer.aboard)); }
    function biking() { const v = game.player.vehicle; return !!(v && v.kind === 'bike' && Math.abs(v.speed || 0) > 1.5); }
    function check() {
      const p = game.player, cam = game.camera, hour = game.time.hour, night = game.time.isNight, W = game.weather;
      let fwd = null;
      for (let i = 0; i < CURIOS.length; i++) {
        const c = CURIOS[i];
        if (found.has(c.id) || c.how === 'use' || c.how === 'sit') continue;
        if (c.how === 'high') {
          const inPlace = c.place ? p.place === c.place && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < c.r : cam.position.y > (c.minY || 10) && Math.hypot(cam.position.x - c.x, cam.position.z - c.z) < c.r;
          if (inPlace && conditionMet(c, hour, night, W)) find(c);
          continue;
        }
        if (p.place !== 'world') continue;
        const dx = c.x - p.pos.x, dz = c.z - p.pos.z;
        if (Math.abs(dx) > c.r + 2 || Math.abs(dz) > c.r + 2) continue;
        if (Math.hypot(dx, dz) > c.r) continue;
        if (c.need === 'boat' && !boating()) continue;
        if (c.need === 'bike' && !biking()) continue;
        if (!c.need && p.vehicle && p.vehicle.kind !== 'bike') continue;       // (on foot or on a bike)
        if (!conditionMet(c, hour, night, W)) continue;
        if (c.how === 'look') {
          if (!fwd) fwd = cam.getWorldDirection(_dir);
          const tx = c.x - cam.position.x, ty = (c.y || 0) - cam.position.y, tz = c.z - cam.position.z, tl = Math.hypot(tx, ty, tz) || 1;
          if ((tx * fwd.x + ty * fwd.y + tz * fwd.z) / tl < 0.9) continue;      // (within ~25 degrees of the middle of the view)
        }
        find(c);
      }
    }
    function passportLine() {
      // the tally at the foot of the passport page (systems/passport.js draws the page; we add one line, no names)
      const open = game.activity && game.activity.name === 'passport';
      if (!open) { S.passportShown = false; return; }
      if (S.passportShown) return;
      try {
        const o = game.ui.el.overlay, box = o && o.firstElementChild; if (!box) return;
        const d = document.createElement('div'); d.className = 'curio-tally';
        d.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid #b9974f;font-size:16px;color:#e6c97f';
        d.textContent = tallyText(found.size) + (found.size ? '' : ''); box.appendChild(d); S.passportShown = true;
      } catch { S.passportShown = true; }
    }

    function tick(dt) {
      if (!S.built) { S.built = true; try { buildProps(); } catch (e) { console.error('[curiosities] props', e); } addInteracts(); }
      tickBusker(dt);
      passportLine();
      if ((S.t -= dt) > 0) return;
      S.t = CHECK;
      // show the props only near one
      if (S.mesh) {
        const cp = game.camera.position; let near = false;
        if (game.player.place === 'world' || game.scene === game.worldScene) for (let i = 0; i < CURIOS.length && !near; i++) { const c = CURIOS[i]; if (c.prop && Math.abs(c.x - cp.x) < SHOW && Math.abs(c.z - cp.z) < SHOW) near = true; }
        S.mesh.visible = near;
      }
      check();
    }

    game.curiosities = {
      get count() { return found.size; }, total: CURIOS.length,
      isFound: (id) => found.has(id), check, tallyText: () => tallyText(found.size),
      reset() { found.clear(); save(); }, debugFind: (id) => { const c = byId.get(id); return c ? find(c, true) : false; },
      stats: () => ({ found: found.size, total: CURIOS.length, finds: S.finds, built: S.built, propTris: S.tris || 0, propsVisible: !!(S.mesh && S.mesh.visible), busker: !!(S.busker && !S.busker.fake) }),
    };
    return { id: 'curiosities', update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[curiosities]', e); } } } };
  },
};
