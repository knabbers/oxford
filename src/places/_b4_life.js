// Small life at the batch-4 sites (visual pass 2026-11): drinkers on the Ferryman's terrace, tourists at the Martyrs'
// Memorial, a crew carrying their eight down to the stage, a coach cycling the towpath beside the second eight, and
// joggers on the Iffley Road track. Everything is a function of the shared clock and fixed positions (the same for every
// player, nothing sent), and costs nothing unless the local player is near: people are spawned on approach and removed
// beyond their radius, moving meshes are hidden.
//
// Speech uses ONLY lines that already exist as voiced crowd lines (docs/VOICES.md; checked against tools/voices/lines.json
// when written) — no new lines, no new clips.
import * as THREE from 'three';
import { createCharacter, randomLook } from '../core/characters.js';
import { b4Pack, geoOf, RB, bike, h01, frame } from './_b4_kit.js';

export const DRINK_LINES = ['Another round?', 'Pint of the usual?', 'Lovely day for it.', 'Did you see that?'];
export const TOURIST_LINES = ['Which one is the Harry Potter college?', 'Lovely day for it.'];
export const QUEUE_LINES = ['Who has the cloakroom ticket?', 'Should have brought a coat.', 'Has anyone got a hairband?', 'Have you got any cash?'];
export const BOATER_LINES = ['Lovely day for it.', 'Lovely morning for staying dry.'];
export const COACH_LINES = ['Lovely stuff.', 'Erg scores are up!', 'Erg at six tomorrow. Worth it.', 'Lovely day for it.'];

/**
 * A set of scripted people that exists only while the local player is within r of c and the hour is in [h0, h1).
 * spec: {c: [x, z], r, h0, h1, people: [{x, z, h, look, pose, lines, label}]}
 */
export function nearSet(game, spec) {
  const S = { peds: [], on: false };
  S.tick = () => {
    const p = game.player, h = game.time.hour, inHours = spec.h0 < spec.h1 ? h >= spec.h0 && h < spec.h1 : h >= spec.h0 || h < spec.h1;
    const d = Math.hypot(p.pos.x - spec.c[0], p.pos.z - spec.c[1]), world = p.place === 'world';
    // Nobody appears or goes in view (2026-11-24): a few people are put there while still too far off to be drawn (the
    // walkers' system fades them in with the distance); a big set, kept to its own radius, comes when nobody is looking
    // at the spot - or, with the player nearly on top of it, fades in. When the hour is up they go unseen too.
    const rOn = spec.people.length <= 8 ? Math.max(spec.r, 152) : spec.r;
    const want = world && inHours && d < (S.on ? rOn + 20 : rOn);
    if (want === S.on) return;
    const P = game.pedestrians, unseen = !world || !P || !P.unseen || P.unseen(spec.c[0], spec.c[1]);
    if (want ? !unseen && d > spec.r * 0.5 : world && !unseen) return;
    S.on = want;
    if (want && P && P.spawnAt) {
      for (const q of spec.people) { try { const ped = P.spawnAt(q.x, q.z, q.look, { heading: q.h, pose: q.pose || 'stand', lines: q.lines || null, label: q.label || null, knockable: true }); S.peds.push(ped); if (!unseen && P.fadeIn) P.fadeIn(ped); } catch (e) { console.warn('[b4 life] spawn', e); } }
    } else if (!want) { for (const ped of S.peds) { try { P.remove(ped); } catch { /* */ } } S.peds.length = 0; }
  };
  S.count = () => S.peds.length;
  return S;
}

const rowerLook = (i, seed) => randomLook(seed * 31 + i * 7, { outfit: 'rower' });

/**
 * The crew carrying their eight from a rack to the water, once every `period` ms of shared time: 8 live characters under
 * an upturned hull (one mesh in the shared atlas material). path: [[x, z] rack, [x, z] stage]; offset ms.
 */
export function createCarry(game, path, o = {}) {
  const period = o.period || 180000, walk = o.walk || 16000, offset = o.offset || 0, R = o.near || 90;
  const S = { crew: null, hull: null, on: false, t: -1, force: null };
  const L = 17.2, hullH = 1.5;
  function build() {
    const pack = b4Pack(game.world), B = new RB();
    // an upturned shell: two sloping sides and a keel line, the riggers sticking out (seen from below / the side)
    B.push(frame(0, 0, 0, 0, 1));            // local x = along the boat (world +z of the group), local z = across
    for (const s of [-1, 1]) B.poly('hull', [[-L / 2 + 0.6, hullH, s * 0.27], [L / 2 - 0.6, hullH, s * 0.27], [L / 2 - 0.6, hullH + 0.24, s * 0.06], [-L / 2 + 0.6, hullH + 0.24, s * 0.06]], [0, 0.4, s]);
    B.box('hull', 0, hullH + 0.25, 0, L - 1.2, 0.03, 0.12, 0);
    for (const s of [-1, 1]) { B.poly('hull', [[s * (L / 2 - 0.6), hullH, -0.27], [s * (L / 2 + 0.3), hullH + 0.14, 0], [s * (L / 2 - 0.6), hullH, 0.27]], [s, -0.6, 0]); B.poly('hull', [[s * (L / 2 - 0.6), hullH, 0.27], [s * (L / 2 + 0.3), hullH + 0.14, 0], [s * (L / 2 - 0.6), hullH + 0.24, 0.06]], [s, 0.5, 0.3]); B.poly('hull', [[s * (L / 2 - 0.6), hullH + 0.24, -0.06], [s * (L / 2 + 0.3), hullH + 0.14, 0], [s * (L / 2 - 0.6), hullH, -0.27]], [s, 0.5, -0.3]); }
    for (let r = 0; r < 8; r++) { const x = -5.9 + r * 1.42, s = r % 2 ? 1 : -1; B.beam('iron', [x, hullH + 0.02, s * 0.25], [x, hullH - 0.04, s * 0.85], 0.035); }
    B.box('varnish', 0, hullH - 0.01, 0, L - 2, 0.02, 0.44, 0, { bottom: true, top: false });
    B.pop();
    const geo = geoOf(B, pack);
    S.hull = new THREE.Mesh(geo, pack.atlas); S.hull.name = 'b4x:carry'; S.hull.frustumCulled = false; S.hull.visible = false; S.hull.castShadow = true;
    game.worldScene.add(S.hull);
    S.crew = []; for (let i = 0; i < 8; i++) { const ch = createCharacter(rowerLook(i, o.seed || 1)); ch.group.visible = false; game.worldScene.add(ch.group); S.crew.push(ch); }
  }
  S.at = (tMs) => {
    const t = ((tMs + offset) % period + period) % period;
    if (t > walk) return null;
    const f = Math.min(1, t / walk), [a, b] = path, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
    return { x, z, h: Math.atan2(b[0] - a[0], b[1] - a[1]), f, moving: f > 0.02 && f < 0.98 };
  };
  S.tick = (dt) => {
    const p = game.player, cam = game.camera.position, h = game.time.hour;
    const st = S.force != null ? S.at(((S.force * walk - offset) % period + period) % period) : h > 7 && h < 19.5 ? S.at(game.time.now()) : null;
    const on = !!st && p.place === 'world' && Math.hypot(cam.x - path[0][0], cam.z - path[0][1]) < R;
    if (on && !S.hull) { try { build(); } catch (e) { console.warn('[b4 life] carry', e); S.hull = { visible: false, isFake: true }; S.crew = []; } }
    if (on !== S.on) { S.on = on; if (S.hull && !S.hull.isFake) S.hull.visible = on; for (const c of S.crew || []) c.group.visible = on; }
    if (!on || !S.hull || S.hull.isFake) return;
    // the hull (group-less mesh: +z along the boat), the crew in two files under it, stepping in time
    S.hull.position.set(st.x, 0, st.z); S.hull.rotation.y = st.h; S.hull.updateMatrix();
    const ux = Math.sin(st.h), uz = Math.cos(st.h);
    S.crew.forEach((c, i) => {
      const along = -5.9 + i * 1.42, side = (i % 2 ? 1 : -1) * 0.18;
      c.group.position.set(st.x + ux * along + uz * side, 0, st.z + uz * along - ux * side);
      c.group.rotation.y = st.h; c.update(dt, st.moving ? 1.25 : 0);
    });
  };
  S.stats = () => ({ on: S.on, crew: S.crew ? S.crew.length : 0 });
  /** tests / screenshots: pin the carry at fraction f of its walk (null: back to the shared clock) */
  S.pin = (f) => { S.force = f; return f == null ? null : S.at(((f * walk - offset) % period + period) % period); };
  return S;
}

/**
 * The coach on a bike on the towpath, level with the second eight: eightFn(tMs) -> {x, z, h, rowing}; side(x, z, h) ->
 * the towpath point abreast of it, or null. Says a coach line (existing voiced crowd lines) every ~9 s while you are near.
 */
export function createCoach(game, eightFn, side, o = {}) {
  const S = { ch: null, bike: null, on: false, slot: -1, said: 0 };
  function build() {
    const pack = b4Pack(game.world), B = new RB();
    bike(B, 0, 0, 0, 'navy', 0);
    S.bike = new THREE.Mesh(geoOf(B, pack), pack.atlas); S.bike.name = 'b4x:coachbike'; S.bike.frustumCulled = false; S.bike.visible = false;
    game.worldScene.add(S.bike);
    S.ch = createCharacter(randomLook(4417, { outfit: 'casual' })); S.ch.setPose('cycle'); S.ch.group.visible = false; game.worldScene.add(S.ch.group);
  }
  S.tick = (dt) => {
    const now = game.time.now(), e = eightFn(now), p = game.player, h = game.time.hour;
    const pt = e && e.rowing > 0.5 && h > 6 && h < 20.5 ? side(e.x, e.z, e.h) : null;
    const cam = game.camera.position;
    const on = !!pt && p.place === 'world' && Math.hypot(cam.x - pt.x, cam.z - pt.z) < (o.near || 160);
    if (on && !S.ch) { try { build(); } catch (err) { console.warn('[b4 life] coach', err); S.ch = { fake: true, group: { visible: false } }; } }
    if (S.ch && S.ch.fake) return;
    if (on !== S.on) { S.on = on; if (S.ch) { S.ch.group.visible = on; S.bike.visible = on; } }
    if (!on) return;
    S.ch.group.position.set(pt.x, 0, pt.z); S.ch.group.rotation.y = pt.h; S.ch.update(dt, 4.4);
    S.bike.position.set(pt.x, 0, pt.z); S.bike.rotation.y = pt.h; S.bike.updateMatrix();
    // a line on a shared 9 s slot when the player is within 30 m (everyone near hears the same line)
    const k = Math.floor(now / 9000);
    if (k !== S.slot) { S.slot = k; if (Math.hypot(p.pos.x - pt.x, p.pos.z - pt.z) < 30 && h01(k, 5) < 0.7) { try { S.ch.say(COACH_LINES[k % COACH_LINES.length], 3); S.said++; } catch { /* */ } } }
  };
  S.stats = () => ({ on: S.on, said: S.said });
  return S;
}

/**
 * Joggers on a closed loop (the Iffley Road track): pos(d) -> {x, z, h} at distance d along the loop of length P.
 * n runners at their own paces, a function of the shared clock; drawn only within `near` m by day.
 */
export function createRunners(game, pos, P, o = {}) {
  const n = o.n || 3, S = { list: [], on: false };
  const pace = (i) => 3.4 + h01(i, 41) * 1.4, ofs = (i) => h01(i, 43) * P;
  S.at = (i, tMs) => pos(((tMs / 1000) * pace(i) + ofs(i)) % P, i);
  S.tick = (dt) => {
    const p = game.player, cam = game.camera.position, h = game.time.hour;
    const on = p.place === 'world' && h > 6.5 && h < 20 && Math.hypot(cam.x - o.c[0], cam.z - o.c[1]) < (o.near || 170);
    if (on && !S.list.length) { try { for (let i = 0; i < n; i++) { const c = createCharacter(randomLook(9100 + i * 13, { outfit: i % 2 ? 'rower' : 'casual' })); c.group.visible = false; game.worldScene.add(c.group); S.list.push(c); } } catch (e) { console.warn('[b4 life] runners', e); } }
    if (on !== S.on) { S.on = on; for (const c of S.list) c.group.visible = on; }
    if (!on) return;
    const now = game.time.now();
    S.list.forEach((c, i) => { const q = S.at(i, now); c.group.position.set(q.x, 0.05, q.z); c.group.rotation.y = q.h; c.update(dt, pace(i)); });
  };
  S.stats = () => ({ on: S.on, n: S.list.length });
  return S;
}
