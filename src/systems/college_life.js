// College life at New College, Merton, Keble and the Oxford Union (batch 5), plus evensong heard outside six chapels.
//
//   porters      one in each gate passage (generic, unnamed; pedestrians.spawnAt, only while you are near). Outside
//                visiting hours (_college_logic.js COLLEGES.hours) walking in through the gate gets you turned round,
//                politely ("College is closed to visitors."); in hours you get a welcome and a reminder about the grass.
//   sneaking     the quads are not sealed: in by another way after hours (the garden, round the back, over a low
//                railing) and you are "in" — with a small chance every few seconds that a porter on his rounds
//                notices, has a quick word and walks you out of the gate (a fade: "shown out", as at closing time).
//                Bloodless, no wanted level, no fine. Found-out and got-away tallies in game.state.flags.
//   the grass    New College's Great Quad lawn and Merton's Fellows' Quad: a second on it and the nearest porter
//                shouts (voiced), you are walked back to the path, and each offence of the day earns a sillier line.
//   quad life    students in gowns and dons in tweed crossing each quad by day on fixed paths (a function of the
//                shared clock: the same people in the same places for everybody), now and then saying a crowd line.
//   evensong     18:00-18:45 the organ and choir (the Worcester chapel's synth, places/_worcint_audio.js IntAudio,
//                no audio files) are heard outside New College, Merton and Keble chapels, Magdalen's, Christ Church
//                Cathedral and Worcester chapel on its service days, fading with distance.
//
// Speech: voiced crowd lines only (systems/_college_logic.js, and for the quad walkers systems/_street_lines.js).
// Nothing is sent: everything shared is a function of the clock; the porter's catching you is your own client's business.
// Cost: up to 1 porter + 3 walkers (characters) within 90 m of a college; nothing elsewhere.
//
// Test hooks: game.collegeLife = { stats(), zoneAt(x, z), forceHour, colleges }     tools/smoke_todo.mjs
import { createCharacter, randomLook } from '../core/characters.js';
import { Q as ncQ, toQ as ncToQ } from '../places/_b5_newcoll.js';
import { F as MTF } from '../places/_b5_merton.js';
import { F as KBF } from '../places/_b5_keble.js';
import { F as UNF } from '../places/_b5_union.js';
import { IntAudio } from '../places/_worcint_audio.js';
import { evensong as wEvensong } from '../places/_worcint_logic.js';
import { evensong as chEvensong } from '../places/_chch_logic.js';
import {
  COLLEGES, PORTER_IDLE, TURN_AWAY, WELCOME, CAUGHT, ESCORT, GRASS, GRASS_TOASTS, STUDENT_LINES, DON_LINES,
  isOpen, hoursText, inRects, inBox, onLawn, offLawn, walkerAt, evensongNow, h01, pick,
} from './_college_logic.js';
import { SPEECH, quadLines, spokenBefore, epochLine, note } from './_street_lines.js';

const FRAMES = { nc: { Q: ncQ, toQ: ncToQ }, mt: MTF, kb: KBF, un: UNF };
import { DAY_MS as DAY } from '../core/time.js';
const NEAR = 90;
// chapels heard outside at evensong: [name, x, z, service(hourDay)]
const dayOf = (now) => Math.floor(now / DAY);

export default {
  id: 'college_life',
  install(game) {
    const S = { err: false, t: 0, chk: 0, cur: null, inGate: null, sneak: null, escorting: null, lawnT: 0, lawnCd: 0, grassDay: -1, grassN: 0, turned: 0, welcomed: 0, escorted: 0, gotAway: 0, said: 0, heard: new Set(), forceHour: null, chance: 0.14 };
    // each college's quad frame as an affine map (from three calls of its Q at install), so the per-frame conversions
    // allocate nothing
    const affine = (F) => { const o = F.Q(0, 0), a = F.Q(1, 0), b = F.Q(0, 1); const A = { ox: o[0], oz: o[1], ux: a[0] - o[0], uz: a[1] - o[1], vx: b[0] - o[0], vz: b[1] - o[1] }; const det = A.ux * A.vz - A.vx * A.uz; A.iux = A.vz / det; A.ivx = -A.vx / det; A.iuz = -A.uz / det; A.ivz = A.ux / det; /* u = iux dx + ivx dz, v = iuz dx + ivz dz */ return A; };
    const C = COLLEGES.map((c) => ({ ...c, F: FRAMES[c.frame], A: affine(FRAMES[c.frame]), porter: null, walkers: [], near: false, welcomedAt: -1e9, turnCd: 0 }));
    for (const c of C) { c.gateW = c.F.Q(c.gate.porter[0], c.gate.porter[1]); c.zoneC = c.F.Q((c.zone[0][0] + c.zone[0][1]) / 2, (c.zone[0][2] + c.zone[0][3]) / 2); }
    const toast = (t, s = 5) => { try { game.ui.toast(t, s); } catch { /* */ } };
    const hour = () => (S.forceHour !== null ? S.forceHour : game.time.hour);
    const _w2 = [0, 0];
    /** frame -> world (into a shared pair: copy it if you keep it) */
    const W = (c, u, v) => { const A = c.A; _w2[0] = A.ox + A.ux * u + A.vx * v; _w2[1] = A.oz + A.uz * u + A.vz * v; return _w2; };
    const headW = (c, u, v, h) => { const A = c.A, du = Math.sin(h), dv = Math.cos(h); return Math.atan2(A.ux * du + A.vx * dv, A.uz * du + A.vz * dv); };
    const chapels = [];
    for (const c of C) if (c.chapel) { const p = W(c, c.chapel[0], c.chapel[1]); chapels.push({ name: c.name.replace(/^the /, '') + ' Chapel', x: p[0], z: p[1], on: (h) => evensongNow(h) }); }
    chapels.push({ name: 'Magdalen Chapel', x: 910, z: 332, on: (h) => evensongNow(h) });                  // (G: between the tower and the cloister)
    chapels.push({ name: 'Christ Church Cathedral', x: 365, z: 540, on: (h) => chEvensong(h) });
    chapels.push({ name: 'Worcester Chapel', x: -262, z: -14, on: (h) => wEvensong(dayOf(game.time.now()), h) });    // (G: the north wing of the east range)
    let organ = null;

    // ---------------------------------------------------------------- people (only near)
    function sayFrom(ch, text) { try { if (ch && ch.say) { ch.say(text, 3.5); S.said++; return true; } } catch { /* */ } return false; }
    function porterOf(c) { return c.porter && c.porter.character ? c.porter.character : null; }
    function setNear(c, on) {
      c.near = on;
      const P = game.pedestrians;
      if (on) {
        if (P && P.spawnAt && !c.porter) {
          const g = c.gate.porter, w = W(c, g[0], g[1]);
          try { c.porter = P.spawnAt(w[0], w[1], randomLook(`porter-${c.id}`, { outfit: 'porter', hat: 'bowler' }), { heading: headW(c, g[0], g[1], Math.atan2(-c.gate.inward[0], -c.gate.inward[1])), role: 'porter', lines: PORTER_IDLE, label: null, knockable: true }); } catch (e) { console.warn('[college_life] porter', e); }
        }
        if (!c.walkers.length) {
          c.routes.forEach((r, i) => {
            try {
              const ch = createCharacter(randomLook(`quad-${c.id}-${i}`, { outfit: r.who }));
              ch.group.visible = false; game.worldScene.add(ch.group);
              c.walkers.push({ r, ch, slot: -1, o: {} });
            } catch (e) { console.warn('[college_life] walker', e); }
          });
        }
      } else {
        if (c.porter && P) { try { P.remove(c.porter); } catch { /* */ } } c.porter = null;
        for (const w of c.walkers) { try { w.ch.group.removeFromParent(); w.ch.dispose && w.ch.dispose(); } catch { /* */ } }
        c.walkers.length = 0;
      }
    }
    function tickWalkers(c, dt, now, h) {
      const day = h >= 8 && h < 19.5, p = game.player;
      for (let i = 0; i < c.walkers.length; i++) {
        const w = c.walkers[i];
        // (out at eight, in at half past seven - when nobody is looking at where they are)
        if (w.vis !== day) { const P = game.pedestrians, q = w.ch.group.position; if (w.vis === undefined || !P || !P.unseen || P.unseen(q.x, q.z)) w.vis = day; }
        w.ch.group.visible = w.vis;
        if (!w.vis) continue;
        if (w.fin < 1) { w.fin = Math.min(1, w.fin + dt * 2); if (w.ch.setFade) w.ch.setFade(w.fin); }
        walkerAt(w.r, now, w.o);
        const pt = W(c, w.o.u, w.o.v);
        w.ch.group.position.set(pt[0], game.groundHeight(pt[0], pt[1]), pt[1]);
        w.ch.group.rotation.y = headW(c, w.o.u, w.o.v, w.o.h);
        w.ch.update(dt, w.o.moving ? 1.2 : 0);
        // a line on a shared 14 s slot, now and then (SPEECH.quadSlot), when you are close: everybody near hears the same one,
        // from the college's few lines and the general student / don ones (_street_lines.js), nothing twice running
        const k = Math.floor(now / 14000);
        if (k !== w.slot) {
          w.slot = k; const salt = i * 7 + c.id.length;
          if (h01(k, salt) < SPEECH.quadSlot && Math.hypot(p.pos.x - pt[0], p.pos.z - pt[1]) < 9) {
            const don = w.r.lines === 'don', text = epochLine(quadLines(don ? 'don' : 'student', don ? DON_LINES : STUDENT_LINES), k, spokenBefore(k, (q) => h01(q, salt) < SPEECH.quadSlot), salt);
            note(text, now / 1000); sayFrom(w.ch, text);
          }
        }
      }
    }

    // ---------------------------------------------------------------- where is the player
    const _uv = [0, 0], _zr = { c: null, zone: false, gate: false, u: 0, v: 0 };
    function uvOf(c, x, z) { const A = c.A, dx = x - A.ox, dz = z - A.oz; _uv[0] = A.iux * dx + A.ivx * dz; _uv[1] = A.iuz * dx + A.ivz * dz; return _uv; }
    /** {c, zone: bool, gate: bool, u, v} for a world point, or null */
    function zoneAt(x, z) {
      for (const c of C) {
        const g = c.zoneC;
        if (Math.abs(x - g[0]) > 110 || Math.abs(z - g[1]) > 110) continue;
        const uv = uvOf(c, x, z), u = uv[0], v = uv[1];
        const zone = inRects(c.zone, u, v), gate = inBox(c.gate.box, u, v);
        if (zone || gate) { _zr.c = c; _zr.zone = zone; _zr.gate = gate; _zr.u = u; _zr.v = v; return _zr; }
      }
      return null;
    }

    // ---------------------------------------------------------------- the gate, sneaking, being shown out
    function turnAway(c) {
      const p = game.player, o = W(c, c.gate.out[0], c.gate.out[1]);
      const line = pick(TURN_AWAY, Math.floor(game.time.now() / 20000), c.id.length), quiet = c.turnCd > 0;
      if (!quiet) sayFrom(porterOf(c), line);
      const outH = headW(c, c.gate.out[0], c.gate.out[1], Math.atan2(-c.gate.inward[0], -c.gate.inward[1]));
      p.pos.x = o[0]; p.pos.z = o[1]; p.vx = Math.sin(outH) * 1.2; p.vz = Math.cos(outH) * 1.2; p.heading = outH; if (p.syncMesh) p.syncMesh();
      S.turned++; if (quiet) return; c.turnCd = 6;
      toast(`The porter at ${c.name}: "${line}" Visitors ${hoursText(c)}.` + (S.turned === 1 ? ' (Gates are not the only way in, mind.)' : ''), 5);
    }
    function showOut(c) {
      if (S.escorting) return;
      const p = game.player; S.escorting = c; p.frozen++;
      const P = game.pedestrians; let ped = null;
      try {
        const a = p.heading + Math.PI * 0.8, x = p.pos.x + Math.sin(a) * 2.2, z = p.pos.z + Math.cos(a) * 2.2;
        ped = P && P.spawnAt ? P.spawnAt(x, z, randomLook(`porter-${c.id}-rounds`, { outfit: 'porter', hat: 'bowler' }), { heading: Math.atan2(p.pos.x - x, p.pos.z - z), role: 'porter', label: null, knockable: false }) : null;
      } catch { /* */ }
      const k = Math.floor(game.time.now() / 10000);
      sayFrom(ped && ped.character, pick(CAUGHT, k, 3));
      toast(`A porter on his rounds: "${pick(CAUGHT, k, 3)}"`, 3);
      setTimeout(() => {
        sayFrom(ped && ped.character, pick(ESCORT, k, 5));
        const done = () => {
          const o = W(c, c.gate.out[0], c.gate.out[1]);
          try { if (ped && P) P.remove(ped); } catch { /* */ }
          if (game.player.place === 'world') game.player.teleport(o[0], o[1], headW(c, c.gate.out[0], c.gate.out[1], Math.atan2(-c.gate.inward[0], -c.gate.inward[1])));
          p.frozen = Math.max(0, p.frozen - 1); S.escorting = null; S.sneak = null; S.escorted++;
          const fl = game.state.flags || (game.state.flags = {}); fl.sneakCaught = (fl.sneakCaught || 0) + 1; try { game.save(); } catch { /* */ }
          toast(`Walked politely back out of ${c.name}'s gate. "${pick(ESCORT, k, 5)}" The porter seems almost impressed. Visitors ${hoursText(c)}.`, 6);
        };
        try { if (game.ui && game.ui.fade) game.ui.fade(done); else done(); } catch { done(); }
      }, 2200);
    }

    // ---------------------------------------------------------------- evensong outside
    let lastHeard = null;
    function tickEvensong(dt, h) {
      const p = game.player; if (!game.audio || !game.audio.ctx) return;
      let best = null, bd = 95;
      if (p.place === 'world') for (const ch of chapels) { const d = Math.hypot(p.pos.x - ch.x, p.pos.z - ch.z); if (d < bd && ch.on(h)) { bd = d; best = ch; } }
      if (!organ) { if (!best) return; organ = new IntAudio(game); }
      organ.update(dt, !!best, !!best);
      if (organ.out && best) { const g = Math.pow(1 - bd / 95, 1.6) * 0.75; organ.out.gain.setTargetAtTime(g, organ.ctx.currentTime, 0.4); }
      if (best && best !== lastHeard) {
        const key = best.name + dayOf(game.time.now());
        if (!S.heard.has(key)) { S.heard.add(key); toast(`Evensong drifts out of ${best.name}: the organ, and a choir.`, 4); }
      }
      lastHeard = best;
    }

    // ---------------------------------------------------------------- per frame
    function tick(dt) {
      const p = game.player, now = game.time.now(), h = hour();
      if (S.lawnCd > 0) S.lawnCd -= dt;
      for (const c of C) {
        if (c.turnCd > 0) c.turnCd -= dt;
        const g = c.gateW;
        const d = p.place === 'world' ? Math.hypot(p.pos.x - g[0], p.pos.z - g[1]) : 1e9;
        const want = d < (c.near ? NEAR + 15 : NEAR);
        // (2026-11-24: the porter and the quad's people come and go only while nobody can see the gate - or, with the
        //  player nearly at it, fade in: they used to appear 90 m off in plain view. tools/smoke_popin.mjs)
        if (want !== c.near) {
          const P = game.pedestrians, un = p.place !== 'world' || !P || !P.unseen || P.unseen(g[0], g[1]);
          if (un || (want && d < 40)) { setNear(c, want); if (want && !un) { if (c.porter && P.fadeIn) P.fadeIn(c.porter); for (const w of c.walkers) w.fin = 0; } }
        }
        if (c.near) tickWalkers(c, dt, now, h);
      }
      tickEvensong(dt, h);
      if (p.place !== 'world' || S.escorting) return;
      const z = zoneAt(p.pos.x, p.pos.z);
      const fl = game.state.flags || (game.state.flags = {});
      // through the gate
      if (z && z.gate && !p.vehicle) {
        const c = z.c;
        if (!isOpen(c, h)) { turnAway(c); S.inGate = c; return; }
        if (S.inGate !== c && now - c.welcomedAt > 60000) { c.welcomedAt = now; const line = pick(WELCOME, Math.floor(now / 30000), c.id.length); sayFrom(porterOf(c), line); S.welcomed++; }
        S.inGate = c; S.cur = { c, admitted: true }; return;
      }
      if (!z || !z.zone) { S.inGate = null; if (S.sneak && !z) { if (S.sneak.t > 20) { S.gotAway++; fl.sneakGotAway = (fl.sneakGotAway || 0) + 1; try { game.save(); } catch { /* */ } } S.sneak = null; } if (!z) S.cur = null; S.lawnT = 0; return; }
      const c = z.c;
      S.inGate = null;
      if (!S.cur || S.cur.c !== c) S.cur = { c, admitted: isOpen(c, h) };
      // after hours, in by some other way: sneaking
      if (!isOpen(c, h) && !S.cur.admitted && !p.vehicle) {
        if (!S.sneak || S.sneak.c !== c) { S.sneak = { c, t: 0, roll: 3 }; toast(`You are in ${c.name} after hours. Walk softly. (A porter does rounds.)`, 4); }
        S.sneak.t += dt; S.sneak.roll -= dt;
        if (S.sneak.roll <= 0) { S.sneak.roll = 5; if (Math.random() < S.chance) { showOut(c); return; } }
        if (S.sneak.t > 45 && !S.sneak.won) { S.sneak.won = true; toast(`Nobody has noticed you in ${c.name}. You feel like a fellow.`, 4); }
      }
      // the lawn
      if (c.lawn && !p.vehicle && onLawn(c.lawn, z.u, z.v)) {
        S.lawnT += dt;
        if (S.lawnT > 1.0 && S.lawnCd <= 0) {
          const day = dayOf(now); if (S.grassDay !== day) { S.grassDay = day; S.grassN = 0; }
          const k = Math.floor(now / 7000), line = GRASS[Math.min(S.grassN, GRASS.length - 1)];
          if (!sayFrom(porterOf(c), line)) void k;
          toast(`"${line}" ${GRASS_TOASTS[Math.min(S.grassN, GRASS_TOASTS.length - 1)]}`, 5);
          S.grassN++; S.lawnCd = 6; S.lawnT = 0;
          const o = offLawn(c.lawn, z.u, z.v, [0, 0]), w = W(c, o[0], o[1]);
          p.pos.x = w[0]; p.pos.z = w[1]; p.vx = p.vz = 0; if (p.syncMesh) p.syncMesh();
          fl.grassOffences = (fl.grassOffences || 0) + 1;
        }
      } else S.lawnT = 0;
    }

    game.collegeLife = {
      colleges: C, zoneAt: (x, z) => { const r = zoneAt(x, z); return r && { ...r }; }, isOpen: (id, hh) => isOpen(C.find((c) => c.id === id), hh ?? hour()),
      set forceHour(v) { S.forceHour = v; }, get forceHour() { return S.forceHour; },
      set chance(v) { S.chance = v; },
      stats: () => ({ near: C.filter((c) => c.near).map((c) => c.id), porters: C.filter((c) => c.porter).length, walkers: C.reduce((a, c) => a + c.walkers.length, 0), turned: S.turned, welcomed: S.welcomed, escorted: S.escorted, gotAway: S.gotAway, sneaking: S.sneak ? S.sneak.c.id : null, grassN: S.grassN, said: S.said, organ: !!organ, chapels: chapels.length }),
    };
    return { id: 'college_life', update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[college_life]', e); } } } };
  },
};
