// The river steamer "Grandpont Belle" runs a real timetable on the Isis: from her berth by the Ferryman's terrace below
// Folly Bridge down past Christ Church Meadow and the mouth of the Cherwell to the college boathouses, and back
// (route, timing and deck in _steamer_logic.js — a pure function of the shared clock, so every player sees her in the
// same place and nothing is sent). You board at the gangway while she is alongside ([E], £2), walk about her decks
// (stair to the top deck at the stern), and get off at the far stop or ride back. Nothing is faded or skipped: the trip
// takes its ~3 minutes down and ~5 back (she turns round at both ends) with the river going by.
//
// Passengers: the deck is a floor through game.vehicles.supportAt (wrapped; the support object handed back never
// moves, so core/player.js carries nothing itself) and this system carries whoever is aboard with her each frame, after
// the player has moved, then keeps them on the deck (rails, the saloon, the wheelhouse, the funnel). Other players
// aboard need nothing: they send where they stand, which is on the deck every client draws in the same place.
// Jumping over the side is allowed (systems/swim.js takes it from there). A swimmer in her way is put aside, never left
// inside the hull (tick).
//
// Cost: one atlas draw for the hull (near / far copies, the far one beyond 170 m, nothing beyond 950 m), one for the
// gangway while she is alongside, three passengers within 110 m. ~0.02 ms a frame.
//
// Test hooks: game.steamer = { at(tMs), pose, aboard, board(stop), ashore(), stats(), hullHit(x, z, r) }   tools/smoke_todo.mjs
import * as THREE from 'three';
import { b4Pack, geoOf, RB, frame } from '../places/_b4_kit.js';
import { buildSteamer } from '../places/_b4_folly.js';
import { createCharacter, randomLook } from '../core/characters.js';
import { HULL, DECK, GANG, STOPS, PATH, CYCLE, steamerAt, nextDeparture, RUN_SECS, toLocal, toWorld, deckTop, standable, inHull, SIGHTS_ALONG } from './_steamer_logic.js';

const FARE = 2, NEAR = 170, FAR = 950, Y0 = 0;
const SWIM_R = 0.45, KEEL = -1.1;       // a swimmer's half width; below this (body centre, m) a diver passes under her keel
const DUMMY = { x: 0, z: 0, heading: 0, steamer: true };     // the support handed to the player: never moves
const mins = (s) => (s < 60 ? `${Math.max(1, Math.round(s))} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

export default {
  id: 'steamer',
  install(game) {
    const S = {
      err: false, hooked: false, aboard: false, lu: 0, lw: 0, pose: { x: 0, z: 0, h: 0, phase: '', docked: null, left: 0, speed: 0, trip: 0 },
      prev: { x: 0, z: 0, h: 0, ok: false }, nudged: 0, jumpT: 0, ppx: 0, ppz: 0, ly: 0, lastPhase: null, said: new Set(), trips: 0, boarded: 0, carried: 0, near: false, lastHoot: -1,
    };
    const scene = game.worldScene, group = new THREE.Group(); group.name = 'steamer'; group.rotation.order = 'YXZ';
    let hiM = null, loM = null, plankA = null, plankB = null; const pax = [];
    try {
      const pack = b4Pack(game.world);
      const SP = { x: 0, z: 0, h: 0, L: HULL.L, B: HULL.B, c0: DECK.c0, c1: DECK.c1, cw: DECK.cw, canopy: DECK.canopy };
      const mk = (q) => {
        const B = buildSteamer(q, SP);
        // the companion stair at the stern (mesh local: x = along, +z = starboard, the opposite of the logic's w)
        B.push(frame(0, 0, 0, 0, 1));
        const [u0, u1, hw] = DECK.stair, n = q === 0 ? 8 : 4, du = (u1 - u0) / n, dy = (DECK.top - DECK.main) / n;
        for (let k = 0; k < n; k++) B.box('oak', u0 + (k + 0.5) * du, DECK.main + (k + 1) * dy - 0.05, 0, du + 0.02, 0.07, hw * 2, 0);
        for (const s of [-1, 1]) { B.beam('white', [u0, DECK.main + 0.9, s * (hw + 0.04)], [u1, DECK.top + 0.9, s * (hw + 0.04)], 0.045); B.beam('oak', [u0, DECK.main, s * (hw + 0.02)], [u1, DECK.top, s * (hw + 0.02)], 0.06, 0.22); }
        if (q === 0) for (const s of [-1, 1]) B.beam('white', [DECK.c0, DECK.top + 1.0, s * (DECK.cw + 0.1)], [DECK.c0, DECK.top + 1.0, s * (hw + 0.1)], 0.04);   // the top deck's after rail either side of the stair head
        B.pop();
        const g = geoOf(B, pack); const m = new THREE.Mesh(g, pack.atlas); m.castShadow = q === 0; m.receiveShadow = true; m.name = 'steamer:' + (q ? 'far' : 'near');
        return m;
      };
      hiM = mk(0); loM = mk(2); loM.visible = false;
      group.add(hiM, loM);
      // the gangways: a plank with rails from the deck edge to the shore (one each side, shown while alongside there)
      const plank = (stop) => {
        const B = new RB(), G = GANG[stop], u = G.deck[0], side = Math.sign(G.deck[1]), z0 = -side * (HULL.B / 2 - 0.4), z1 = -side * (HULL.B / 2 + 1.7);
        B.push(frame(0, 0, 0, 0, 1));
        const y0 = DECK.main + 0.03, y1 = G.shoreH + 0.03, L = Math.abs(z1 - z0), mid = (z0 + z1) / 2, sl = Math.atan2(y0 - y1, L);
        B.beam('deck', [u, y0, z0], [u, y1, z1], 0.85, 0.05);
        for (const s of [-1, 1]) { B.beam('white', [u + s * 0.42, y0 + 0.95, z0], [u + s * 0.42, y1 + 0.95, z1], 0.04); for (const t of [0, 1]) B.box('white', u + s * 0.42, (t ? y1 : y0) + 0.47, t ? z1 : z0, 0.04, 0.95, 0.04, 0, { top: false }); }
        void mid; void sl;
        B.pop();
        const m = new THREE.Mesh(geoOf(B, pack), pack.atlas); m.name = 'steamer:gangway:' + stop; m.visible = false; return m;
      };
      plankA = plank('A'); plankB = plank('B'); group.add(plankA, plankB);
      // passengers: a couple on the top deck, someone on the stern bench, the skipper in the wheelhouse (always aboard)
      const spots = [[2.6, 0.55, DECK.top, Math.PI / 2, 'stand', 'pass-0'], [3.3, 0.6, DECK.top, -Math.PI / 2 + 0.3, 'talk', 'pass-1'], [DECK.wh[0] + 0.8, 0, DECK.main, 0, 'stand', 'skipper']];
      for (const [u, w, y, rh, pose, seed] of spots) {
        try {
          const c = createCharacter(randomLook('belle-' + seed, seed === 'skipper' ? { outfit: 'tweed' } : {}));
          c.setPose(pose); c.group.rotation.y = rh; c.group.visible = false;
          c.group.position.set(w, y, u);       // (group local: x = w, z = u)
          group.add(c.group); pax.push(c);
        } catch (e) { console.warn('[steamer] passenger', e); }
      }
      scene.add(group);
    } catch (e) { console.error('[steamer] build', e); }

    const now = () => game.time.now();
    const P = S.pose, _l = { u: 0, w: 0 }, _w = { x: 0, z: 0 };
    const place = (tMs) => {
      steamerAt(tMs, P);
      group.position.set(P.x, Y0 + Math.sin(tMs / 1700) * 0.015, P.z); group.rotation.set(Math.sin(tMs / 2300) * 0.006, P.h, Math.sin(tMs / 1900) * 0.008);
    };
    place(now());
    S.prev.x = P.x; S.prev.z = P.z; S.prev.h = P.h; S.prev.ok = true;

    // ---------------------------------------------------------------- the deck as a floor (game.vehicles.supportAt)
    // her deck is not "in the drink": the collider's onBridge (so isWet) is true over the hull, as on a pontoon — the
    // walk code lets you move about on it and systems/swim.js does not think you have fallen in
    {
      const col = game.worldCollider, ob = col.onBridge.bind(col), _b = { u: 0, w: 0 };
      col.onBridge = (x, z) => ob(x, z) || (Math.abs(x - P.x) < 12 && Math.abs(z - P.z) < 12 && (toLocal(P.x, P.z, P.h, x, z, _b), inHull(_b.u, _b.w)));
      // aboard, the world's walls (the bank, the terrace's edge, a stage) do not push you about the deck: her rails,
      // saloon and funnel are this system's (the clamp in tick)
      const rs = col.resolve.bind(col);
      col.resolve = (pos, r, o) => (S.aboard && Math.abs(pos.x - P.x) < 12 && Math.abs(pos.z - P.z) < 12 && (toLocal(P.x, P.z, P.h, pos.x, pos.z, _b), inHull(_b.u, _b.w)) ? false : rs(pos, r, o));
    }
    function hook() {
      const V = game.vehicles; if (!V || S.hooked) return;
      S.hooked = true;
      const orig = V.supportAt;
      V.supportAt = function (x, z, y, reach, out) {
        const base = orig ? orig.call(this, x, z, y, reach, out) : -1;
        if (game.player.place !== 'world' || Math.abs(x - P.x) > 13 || Math.abs(z - P.z) > 13) return base;
        toLocal(P.x, P.z, P.h, x, z, _l);
        const t = deckTop(_l.u, _l.w, y - Y0, reach);
        if (t >= 0 && Y0 + t > base) { if (out) out.o = DUMMY; return Y0 + t; }
        return base;
      };
    }

    // ---------------------------------------------------------------- boarding and going ashore
    const toast = (t, s = 5) => { try { game.ui.toast(t, s); } catch { /* */ } };
    function board(stop) {
      const p = game.player;
      if (p.place !== 'world' || p.vehicle || p.swim || S.aboard) return false;
      if (P.docked !== stop) { toast('She is not alongside here just now.', 3); return false; }
      if (!game.pay(-FARE)) { toast(`The steamer is £${FARE}. You have not got £${FARE}.`, 4); return false; }
      const G = GANG[stop];
      toWorld(P.x, P.z, P.h, G.deck[0], G.deck[1], _w);
      p.pos.set(_w.x, Y0 + DECK.main, _w.z); p.vx = p.vz = 0; p.vy = 0; p.speed = 0; p.onGround = true;
      p.heading = P.h + (G.deck[1] < 0 ? Math.PI / 2 : -Math.PI / 2); if (p.syncMesh) p.syncMesh();
      S.aboard = true; S.lu = G.deck[0]; S.lw = G.deck[1]; S.ly = Y0 + DECK.main; S.ppx = p.pos.x; S.ppz = p.pos.z; S.boarded++; S.said.clear();
      const other = stop === 'A' ? STOPS.B : STOPS.A, wait = Math.max(0, P.left);
      toast(`Aboard the Grandpont Belle (£${FARE}) for ${other}: about ${mins(stop === 'A' ? RUN_SECS.AB : RUN_SECS.BA)}. She sails in ${mins(wait)}. The stair to the top deck is at the stern.`, 7);
      return true;
    }
    function ashore() {
      const p = game.player;
      if (!S.aboard || !P.docked) return false;
      const G = GANG[P.docked];
      p.pos.set(G.shore[0], game.groundHeight(G.shore[0], G.shore[1]), G.shore[1]); p.vx = p.vz = 0; p.vy = 0; p.onGround = true; p.support = null;
      if (p.syncMesh) p.syncMesh();
      S.aboard = false;
      toast(P.docked === 'A' ? 'Ashore at Folly Bridge.' : 'Ashore at the boathouses. Boathouses Walk runs back up to the meadow, or wait for her trip back.', 5);
      return true;
    }
    try {
      for (const stop of ['A', 'B']) {
        const G = GANG[stop];
        game.interact.add({
          pos: G.shore, radius: 2.4,
          label: () => `Board the Grandpont Belle (£${FARE}): sails in ${mins(P.left)}`,
          enabled: () => P.docked === stop && P.left > 3 && !S.aboard && !game.player.vehicle,
          onUse: () => board(stop),
        });
        // the timetable board beside the gangway
        const tx = G.shore[0] + (stop === 'A' ? -2.2 : 2.0), tz = G.shore[1] + (stop === 'A' ? -1.0 : 1.6);
        game.interact.add({
          pos: [tx, tz], radius: 1.8, label: 'Read the steamer timetable',
          enabled: () => !S.aboard && !(P.docked === stop && P.left > 3),
          onUse: () => toast(`Grandpont Belle: Folly Bridge to the college boathouses and back, every ${mins(CYCLE)}. Next sailing from here in ${mins(nextDeparture(now(), stop))}. Fare £${FARE}.`, 7),
        });
      }
      const gw = new THREE.Vector3();
      game.interact.add({
        pos: () => { const G = GANG[P.docked || 'A']; toWorld(P.x, P.z, P.h, G.deck[0], G.deck[1], _w); return gw.set(_w.x, Y0 + DECK.main, _w.z); },
        radius: 2.6, label: () => `Step ashore at ${P.docked === 'A' ? 'Folly Bridge' : 'the boathouses'}`,
        enabled: () => S.aboard && !!P.docked && P.left > 2,
        onUse: () => ashore(),
      });
    } catch (e) { console.warn('[steamer] interact', e); }

    // ---------------------------------------------------------------- a whistle as she leaves (synth, no files)
    function hoot(dist) {
      const A = game.audio; if (!A || !A.ctx) return;
      const pl = A.place ? A.place(P.x, P.z, 600) : { pan: 0, gain: Math.max(0, 1 - dist / 600) };
      const gain = 0.16 * (pl.gain ?? 1); if (gain < 0.004) return;
      for (const [w, d] of [[0, 0.7], [0.95, 1.1]]) for (const f of [196, 247, 294]) A.tone(f, d, { type: 'triangle', gain: gain / 3, attack: 0.08, when: w, pan: pl.pan || 0 });
    }

    // ---------------------------------------------------------------- per frame
    function tick(dt) {
      hook();
      const t = now(), p = game.player;
      const px = S.prev.x, pz = S.prev.z, ph = S.prev.h;
      place(t);
      const cam = game.camera.position, dc = Math.hypot(cam.x - P.x, cam.z - P.z);
      const vis = dc < FAR && (p.place === 'world'), hi = dc < NEAR;
      group.visible = vis;
      if (hiM) { hiM.visible = vis && hi; loM.visible = vis && !hi; }
      const alongside = vis && dc < 220 && !!P.docked;
      if (plankA) { plankA.visible = alongside && P.docked === 'A'; plankB.visible = alongside && P.docked === 'B'; }
      const paxOn = vis && dc < 110;
      if (paxOn !== S.near) { S.near = paxOn; for (const c of pax) c.group.visible = paxOn; }
      if (paxOn) for (const c of pax) c.update(dt, 0);
      // departure: two hoots (once per departure, for everyone near — the clock decides)
      if (S.lastPhase !== P.phase) {
        if ((P.phase === 'down' || P.phase === 'outB') && S.lastPhase) hoot(Math.hypot(p.pos.x - P.x, p.pos.z - P.z));
        if (S.aboard) {
          if (P.phase === 'down') toast('Two hoots. The Belle pulls away from Folly Bridge.', 4);
          else if (P.phase === 'outB') toast('Two hoots, and she is off the stage again, turning for Folly Bridge.', 4);
          else if (P.phase === 'dockB') toast(`Alongside the boathouses. [E] at the gangway to step ashore, or stay aboard for the trip back (about ${mins(RUN_SECS.BA)}).`, 6);
          else if (P.phase === 'dockA') { S.trips++; toast('Back alongside at Folly Bridge. [E] at the gangway to step ashore.', 5); }
          else if (P.phase === 'windB' || P.phase === 'windA') toast('She turns round in midstream: the whole river swings past.', 4);
        }
        S.lastPhase = P.phase; S.said.clear();
      }
      // a swimmer she comes over is put aside: out past the nearer side, a body's width clear of the hull, rather than left
      // inside it (one who has dived well under her keel is left to it). Each client minds its own player; others' swimmers
      // are where they say they are, which their own client keeps out of the hull the same way.
      {
        const sw = game.swim;
        if (sw && sw.mode === 'swim' && !S.aboard && p.place === 'world') {
          const st = sw.state;
          if (st && Math.abs(st.x - P.x) < 14 && Math.abs(st.z - P.z) < 14 && st.y > KEEL) {
            toLocal(P.x, P.z, P.h, st.x, st.z, _l);
            const hw = HULL.B / 2 + SWIM_R;
            if (Math.abs(_l.u) < HULL.L / 2 + SWIM_R && Math.abs(_l.w) < hw) {
              const sd = _l.w < 0 ? -1 : 1;
              toWorld(P.x, P.z, P.h, _l.u, sd * (hw + 0.05), _w);
              if (!game.worldCollider.isWet(_w.x, _w.z)) toWorld(P.x, P.z, P.h, _l.u, -sd * (hw + 0.05), _w);     // (that side is the bank: the other)
              st.x = _w.x; st.z = _w.z; p.pos.x = _w.x; p.pos.z = _w.z; S.nudged++;
              if (p.syncMesh) p.syncMesh();
            }
          }
        }
      }
      // carry the passenger with her, then keep them on the deck
      if (S.aboard) {
        const lost = p.place !== 'world' || p.vehicle || p.swim || (p.swimming) || (game.swim && game.swim.active);
        toLocal(px, pz, ph, p.pos.x, p.pos.z, _l);
        const jumped = Math.hypot(p.pos.x - S.ppx, p.pos.z - S.ppz) > 4;      // (moved by something else: a door, a teleport)
        // (over the side only by jumping: walking or sprinting into the rail is held by the clamp below)
        if (lost || jumped || (!inHull(_l.u, _l.w) && p.onGround && S.jumpT > 0)) S.aboard = false;
        else {
          toWorld(P.x, P.z, P.h, _l.u, _l.w, _w);
          {
            p.pos.x = _w.x; p.pos.z = _w.z;
            let dh = P.h - ph; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); p.heading += dh;
            if (p.vy > 3) S.jumpT = 1.3; else if (S.jumpT > 0) S.jumpT -= dt;      // (a jump may go over the side; walking off it may not)
            if ((p.onGround || S.jumpT <= 0) && !standable(_l.u, _l.w, S.ly - Y0)) { toWorld(P.x, P.z, P.h, S.lu, S.lw, _w); p.pos.x = _w.x; p.pos.z = _w.z; p.pos.y = S.ly; p.vy = 0; p.vx *= 0.3; p.vz *= 0.3; }
            else if (p.onGround) { S.lu = _l.u; S.lw = _l.w; S.ly = p.pos.y; }
            else if (!inHull(_l.u, _l.w)) { /* over the side: falling to the water, swim takes over */ }
            S.carried += Math.hypot(P.x - px, P.z - pz);
            if (p.syncMesh) p.syncMesh();
          }
        }
        S.ppx = p.pos.x; S.ppz = p.pos.z;
        // a line about what is going by (once each, each way)
        if (S.aboard && (P.phase === 'down' || P.phase === 'up')) {
          const s = P.phase === 'down' ? P.trip * PATH.L : PATH.L - P.trip * (PATH.L - 32.9);
          for (let i = 0; i < SIGHTS_ALONG.length; i++) {
            const g = SIGHTS_ALONG[i], key = P.phase + i;
            if (!S.said.has(key) && Math.abs(s - g.s) < 12) { S.said.add(key); toast(P.phase === 'down' ? g.down : g.up, 6); }
          }
        }
      } else if (p.support === DUMMY && p.place === 'world') {
        S.aboard = true; toLocal(P.x, P.z, P.h, p.pos.x, p.pos.z, _l); S.lu = _l.u; S.lw = _l.w; S.ly = p.pos.y; S.ppx = p.pos.x; S.ppz = p.pos.z;      // (climbed or jumped aboard)
      }
      S.prev.x = P.x; S.prev.z = P.z; S.prev.h = P.h;
    }

    game.steamer = {
      pose: P, at: (tMs) => steamerAt(tMs, {}), board, ashore, hullHit,
      get aboard() { return S.aboard; },
      stats: () => ({ phase: P.phase, docked: P.docked, left: +P.left.toFixed(1), x: +P.x.toFixed(1), z: +P.z.toFixed(1), aboard: S.aboard, nudged: S.nudged, boarded: S.boarded, trips: S.trips, carried: Math.round(S.carried), visible: group.visible, near: !!(hiM && hiM.visible), hooked: S.hooked }),
    };
    /** does a circle (x, z, r) touch her hull? (for rowing boats and the like) */
    function hullHit(x, z, r = 0) {
      if (Math.abs(x - P.x) > 14 || Math.abs(z - P.z) > 14) return false;
      toLocal(P.x, P.z, P.h, x, z, _l);
      return Math.abs(_l.u) < HULL.L / 2 + r && Math.abs(_l.w) < HULL.B / 2 + r;
    }
    return { id: 'steamer', update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[steamer]', e); } } } };
  },
};
