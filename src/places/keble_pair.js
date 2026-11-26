// Andre and Computer Science Chris (the user's friends, places/_people.js): a pair who hang around outside the Computer
// Science department (the Wolfson Building, Keble Road / Parks Road) opposite Keble College, and some days wander into
// town together. Where they are is a pure function of the SHARED clock (_keble_pair_logic.js pairAt), so every player
// sees them in the same place; walks follow the pedestrians' pavement graph between the same two spots over the same
// time (the graph is built from the map, identical on every client). Andre leads, Chris walks a step behind / beside him.
// Speech: one shared slot every SLOT_S seconds (same line, same moment for every client with a player near), Andre's
// catchphrase when anyone walks up, "[E] Talk" to either. Voices: pre-rendered clips via FriendVoices (V toggles, in
// friends.js). Nothing is drawn or animated when the local player is far; a person someone is playing is hidden.
// Who hears what (as friends.js): the slot lines are decided from the shared clock and from where ANY player is — never from
// the local player's own dialog box; an [E] Talk is its owner's ('kebleTalk': each page, with its speaker, as the owner
// turns to it — the other players hear the pair say it and see them held, turned to that player; two presses at once:
// the earlier on the shared clock keeps it, then the lower id). Private: Andre's wordless wave as a player walks up.
// Tagging along (_friends_follow.js, as the Worcester friends do): now and then, while they are standing about with
// nothing to walk to for a while, the two of them fall in with a player near them (always both; likelier after a talk),
// and go back to their pavement when their day moves on, they have had enough, or the player goes too far from Keble.
// They say nothing new for it (Andre waves; their own lines carry on). whereIs(id).following = that player's id or null.
//   game.kebleFriends = { npcs, whereIs(id), plan(day), debugHour(h|null), debugLineup(x, z, h), debugOff(), routeOf(from, to) }
import * as THREE from 'three';
import { createCharacter } from '../core/characters.js';
import { PEOPLE, lookFor, personOf } from './_people.js';
import { FriendVoices } from './_friends_voice.js';
import { playersNear } from './_friends_yang.js';
import { SPOTS, SLOT_S, pairAt, dayPlan, slotEvent, walkupLine, talkPages, strollAt, hash01, KEBLE } from './_keble_pair_logic.js';
import { FollowCrew, GAIT_MAX } from './_friends_follow.js';
import { seatAt, seatCount } from '../systems/sitting.js';

import { DAY_MS, HOUR_S } from '../core/time.js';
const VIS_FAR = 150, ANIM_FAR = 90, ROUTE_NEAR = 260;
const WALKUP_R = 4.5, NEAR_R = 14, WALKUP_COOL_MS = 40000;
const IDS = ['andre', 'chris'];
const lerp = (a, b, t) => a + (b - a) * t;

export default {
  id: 'keble_pair',
  install(game) {
    if (!PEOPLE.andre || !PEOPLE.chris) return {};
    const scene = game.worldScene, ped = game.pedestrians;
    // ---- spots snapped to the pavement graph (deterministic: same graph on every client)
    const S = {}, G = ped && ped.graph;
    /** index of the graph node nearest (x, z) within r, or -1 (a plain scan: a few dozen calls at install) */
    const nearestNode = (x, z, r) => { if (!G) return -1; let best = -1, bd = r * r; for (let i = 0; i < G.count; i++) { const ex = G.X[i] - x, ez = G.Z[i] - z, d2 = ex * ex + ez * ez; if (d2 < bd) { bd = d2; best = i; } } return best; };
    for (const [k, s] of Object.entries(SPOTS)) {
      const snap = (p) => { if (!p) return p; const i = nearestNode(p[0], p[1], 6); return i >= 0 ? [G.X[i], G.Z[i]] : p; };
      const a = snap(s.a), b = s.b ? snap(s.b) : null;
      S[k] = { ...s, a, b: b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 2 ? b : s.b ? [a[0] + (s.b[0] - s.a[0]), a[1] + (s.b[1] - s.a[1])] : null };
      // which side of the stroll line Chris stands on: the side nearer a pavement node (never the road / a wall)
      const B = S[k].b || [a[0], a[1] + 1], dx = B[0] - a[0], dz = B[1] - a[1], l = Math.hypot(dx, dz) || 1, px = -dz / l, pz = dx / l;
      let side = 1;
      if (G && game.worldCollider) {
        const free = (sg) => { const x = a[0] + px * sg, z = a[1] + pz * sg; return game.worldCollider.isFree ? game.worldCollider.isFree(x, z, 0.3) : true; };
        const node = (sg) => { const i = nearestNode(a[0] + px * sg * 1.1, a[1] + pz * sg * 1.1, 4); return i >= 0 ? Math.hypot(G.X[i] - a[0] - px * sg * 1.1, G.Z[i] - a[1] - pz * sg * 1.1) : 9; };
        const sc = (sg) => (free(sg) ? 0 : 10) + node(sg);
        side = sc(-1) < sc(1) ? -1 : 1;
      }
      S[k].px = px * side; S[k].pz = pz * side;
    }
    // ---- routes (from spot `a` to spot `b` over the pavement graph), cached
    const routes = new Map();
    function routeOf(from, to) {
      const key = from + '>' + to;
      let R = routes.get(key); if (R) return R;
      const A = S[from].a, B = S[to].a;
      let pts = ped && ped.route ? ped.route(A[0], A[1], B[0], B[1]) : null;
      pts = [A, ...(pts || []), B];
      const clean = [];
      for (const p of pts) { const q = clean[clean.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.3) clean.push(p); }
      const n = clean.length, xs = new Float32Array(n), zs = new Float32Array(n), cum = new Float32Array(n);
      clean.forEach((p, i) => { xs[i] = p[0]; zs[i] = p[1]; cum[i] = i ? cum[i - 1] + Math.hypot(p[0] - clean[i - 1][0], p[1] - clean[i - 1][1]) : 0; });
      R = { xs, zs, cum, len: cum[n - 1] };
      routes.set(key, R);
      return R;
    }
    const at = { x: 0, z: 0, h: 0 };
    function along(R, d, out) {
      d = Math.max(0, Math.min(R.len, d));
      let i = 1; while (i < R.cum.length - 1 && R.cum[i] < d) i++;
      const l0 = R.cum[i - 1], seg = R.cum[i] - l0, t = seg > 0 ? (d - l0) / seg : 1;
      out.x = lerp(R.xs[i - 1], R.xs[i], t); out.z = lerp(R.zs[i - 1], R.zs[i], t);
      out.h = R.xs.length > 1 ? Math.atan2(R.xs[i] - R.xs[i - 1], R.zs[i] - R.zs[i - 1]) : 0;
      return out;
    }

    // ---- the two characters
    const npcs = IDS.map((id, pi) => {
      const P = PEOPLE[id], ch = createCharacter(lookFor(id));
      ch.setLabel(P.label);
      ch.group.visible = false;
      scene.add(ch.group);
      const n = { id, P, ch, pi, pos: new THREE.Vector3(), x: 0, z: 0, y: 0, h: 0, speed: 0, shown: false, hidden: true, taken: false, walking: false, spot: 'home',
        offX: 0, offZ: 0, lastX: NaN, lastZ: NaN, gy: 0, gyX: NaN, gyZ: NaN, gyT: 0, hold: false, downT: 0, knockT: 0, greetT: 0, near: false, talkN: pi * 3,
        fol: null, fy: NaN, froom: null, fpose: 'stand', hs: 0, rt: { x: 0, z: 0, hidden: true, seen: false } };
      n.handle = game.interact.add({
        pos: () => n.pos, radius: 2.4, label: () => `Talk to ${P.label}`,
        enabled: () => n.shown && !n.ch.isDown && game.player.place === 'world' && !rtalkOn(),
        onUse: () => talk(n),
      });
      return n;
    });
    const [andre, chris] = npcs, byId = new Map(npcs.map((n) => [n.id, n]));
    const voices = new FriendVoices(PEOPLE, { game });
    const dayIdx = () => Math.floor(game.time.now() / DAY_MS);
    let dbgHour = null, dbg = null, takenT = 0, hideLatch = null, slotK = null, walkN = 0, walkT = -1e15;
    const pending = [];         // [{at (ms, shared clock), who, text}] second halves of exchanges

    function bubble(n, text, priority = false) {
      if (!n.shown || !text) return;
      heardT = performance.now();
      n.ch.say(text, Math.max(Math.min(6, 1.6 + text.length * 0.06), (voices.duration(n.id, text) || 0) + 0.6));
      const p = game.player.pos; voices.say(n.id, text, Math.hypot(p.x - n.pos.x, p.z - n.pos.z), priority, { pos: n.pos, ch: n.ch });
    }
    // ---- [E] Talk: ours (sent page by page), or another player's (rtalk = { p, t0, until }: the pair is held, turned to them)
    let rtalk = null, talkT0 = 0, talkDlg = null, talkYield = false, heardT = 0;
    const myId = () => (game.net && game.net.connected ? game.net.id : 0);
    const rtalkOn = () => !!rtalk && performance.now() < rtalk.until && !!(game.net && game.net.others && game.net.others.has(rtalk.p));
    const sendTalk = (d) => { const net = game.net; if (net && net.connected) net.send('kebleTalk', d); };
    const okText = (t) => typeof t === 'string' && t.length > 0 && t.length <= 240;
    function talk(n) {
      if (rtalkOn() || andre.hold || chris.hold) return;
      for (const m of npcs) m.hold = true;
      const pages = talkPages(n.id, n.talkN++);
      const seq = pages.map((p) => ({ who: PEOPLE[p.who].label, text: p.text, id: p.who }));
      const t0 = game.time.now(); talkT0 = t0; talkYield = false; rtalk = null;
      game.ui.dialog(n.P.label, seq).then(() => {
        const gave = talkYield; talkYield = false; if (gave) return;
        for (const m of npcs) m.hold = false; talkT0 = 0; talkDlg = null; sendTalk({ t0, end: 1 });
        try { crew.onTalk(andre); } catch (e) { /* */ } });
      // each page: spoken here by its own speaker as it is shown, and sent to the other players
      const ui = game.ui, d = ui._dialog; let last = -1, sent = 0; talkDlg = d || null;
      const tick = () => {
        if (!d || ui._dialog !== d || talkYield) return;
        const w = performance.now();
        if (d.i !== last) { last = d.i; sent = w; const l = d.lines[d.i]; if (l && l.id) { const m = byId.get(l.id); if (m) m.ch.say(l.text, 3); voices.say(l.id, l.text, 0, true, m ? { pos: m.pos, ch: m.ch } : null); sendTalk({ t0, i: d.i, w: l.id, s: l.text }); } }
        else if (w - sent > 4000) { sent = w; sendTalk({ t0, i: d.i }); }
        setTimeout(tick, 100);
      };
      tick();
    }
    if (game.net && game.net.on) game.net.on('kebleTalk', (d, o) => {
      if (!d || !o || !Number.isFinite(d.t0)) return;
      if (d.end) { if (rtalk && rtalk.p === o.id) rtalk = null; return; }
      if (talkT0) {
        if (!(d.t0 < talkT0 || (d.t0 === talkT0 && o.id < myId()))) return;
        // theirs began first: our box closes without a word more
        const ui = game.ui, dlg = talkDlg; talkYield = true;
        if (dlg && ui._dialog === dlg && ui.advanceDialog) for (let k = 0; k < 12 && ui._dialog === dlg; k++) ui.advanceDialog();
        for (const m of npcs) m.hold = false; talkT0 = 0; talkDlg = null;
      }
      if (rtalk && rtalk.p !== o.id && rtalkOn() && !(d.t0 < rtalk.t0 || (d.t0 === rtalk.t0 && o.id < rtalk.p))) return;
      rtalk = { p: o.id, t0: d.t0, until: performance.now() + 12000 };
      const m = byId.get(d.w); if (m && okText(d.s)) bubble(m, d.s, true);
    });
    function updateTaken() {
      const t = new Set(), me = personOf(game.player.look, game.player.name); if (me) t.add(me);      // (by look or by name, for us as for the others)
      if (game.net && game.net.others) for (const o of game.net.others.values()) { const p = personOf(o.look, o.name); if (p) t.add(p); }
      for (const n of npcs) n.taken = t.has(n.id);
    }

    // ---- per frame
    const st = {}, ca = { x: 0, z: 0, h: 0 }, cb = { x: 0, z: 0, h: 0 };
    function place(T) {
      if (dbg) {
        andre.hidden = chris.hidden = false; andre.walking = chris.walking = false; andre.speed = chris.speed = 0;
        andre.x = dbg.x; andre.z = dbg.z; andre.h = dbg.h + 0.2;
        chris.x = dbg.x + Math.cos(dbg.h) * 1.1; chris.z = dbg.z - Math.sin(dbg.h) * 1.1; chris.h = dbg.h - 0.2;
        andre.spot = chris.spot = 'lineup';
        return;
      }
      pairAt(T, st);
      const e = st.entry;
      if (st.hidden) {
        // gone (home / from the pub / from town): vanish once nobody local is watching (or after 90 s)
        const key = e ? e.t0 : Math.floor(T);
        if (hideLatch !== key) {
          const pl = game.player.pos, far = game.player.place !== 'world' || Math.hypot(pl.x - andre.x, pl.z - andre.z) > 25;
          const since = e ? (T - e.t0) * HOUR_S : 999;
          if (far || since > 90 || !andre.shown) hideLatch = key;
        }
        const hid = hideLatch === key || !e;
        for (const n of npcs) { n.hidden = hid; n.walking = false; n.speed = 0; n.spot = st.spot; }
        return;
      }
      hideLatch = null;
      for (const n of npcs) { n.hidden = false; n.spot = st.spot; }
      const pl = game.player.pos;
      if (e.kind === 'walk') {
        const far = Math.hypot(pl.x - st.x, pl.z - st.z) > ROUTE_NEAR;
        if (far) {    // nobody local to see them: the straight-line model is enough (no route search)
          andre.x = st.x; andre.z = st.z; andre.h = st.h; chris.x = st.x - Math.sin(st.h) * 0.8; chris.z = st.z - Math.cos(st.h) * 0.8; chris.h = st.h;
          andre.walking = chris.walking = true; andre.speed = chris.speed = st.speed;
          return;
        }
        const R = routeOf(e.from, e.to), dur = (e.t1 - e.t0) * HOUR_S, d = st.u * R.len, v = dur > 0 ? R.len / dur : 0;
        along(R, d, ca); along(R, d - 0.85, cb);
        andre.x = ca.x; andre.z = ca.z; andre.h = ca.h;
        // Chris: a step behind and half a step to Andre's left (perpendicular to his own heading on the route)
        chris.x = cb.x + Math.cos(cb.h) * 0.5; chris.z = cb.z - Math.sin(cb.h) * 0.5; chris.h = cb.h;
        andre.walking = chris.walking = true; andre.speed = chris.speed = Math.min(2.2, v);
        return;
      }
      // staying: Andre strolls up and down his bit of pavement, Chris beside him; standing still they face each other
      const Sp = S[e.spot];
      strollAt(Sp, (T - e.t0) * HOUR_S, ca);
      andre.x = ca.x; andre.z = ca.z;
      chris.x = ca.x + Sp.px * 1.05; chris.z = ca.z + Sp.pz * 1.05;
      andre.walking = chris.walking = ca.moving; andre.speed = chris.speed = ca.speed;
      if (ca.moving) { andre.h = chris.h = ca.h; }
      else { andre.h = Math.atan2(chris.x - andre.x, chris.z - andre.z) + 0.35; chris.h = Math.atan2(andre.x - chris.x, andre.z - chris.z) - 0.35; }
    }

    // ---- tagging along with a player (_friends_follow.js): the pair comes together or not at all
    let curT = 0, folErr = false;
    const wave = (n) => { if (n.shown && !n.ch.isDown) { try { n.ch.setPose('wave', { duration: 1.6 }); } catch (e) { /* */ } } };
    const crew = new FollowCrew(game, {
      npcs, home: KEBLE, range: 600, seatAt, seatCount, pair: () => IDS, walk: () => 1.3,
      at: (n) => n.pos,
      avail(n) {
        if (dbg || npcs.some((q) => q.taken || !q.shown || q.hidden || q.downT > 0 || q.fol) || crew.book.count(crew.me) > 1) return null;
        const e = st.entry; if (!e || e.kind !== 'stay') return null;
        return { hFree: e.t1 - curT, walking: false };
      },
      // (their day moves on when the stay they were in ends: they go back for the walk to the next place)
      commit: () => { const e = st.entry; return e && e.kind === 'stay' ? e.t1 - curT : 0; },
      routine: (n) => n.rt,
      late: () => 24.5,
      enters: (n, room) => room !== 'purple_turtle',
      back(n, x, z, R) { let r = null; try { r = ped && ped.route && Math.hypot(R.x - x, R.z - z) > 12 ? ped.route(x, z, R.x, R.z) : null; } catch { r = null; } return [...(r || []), [R.x, R.z]]; },
      say(n, kind) { if (kind === 'join') wave(andre); else for (const q of npcs) wave(q); },
    });
    // (the doors of walk-in rooms open for them as for anyone: core/interiors.js reads game.walkers)
    (game.walkers || (game.walkers = [])).push(() => npcs.filter((q) => q.fol === 'follow' && !q.hidden));
    function tag(n, dt) {
      const R = n.rt; R.x = n.x; R.z = n.z; R.hidden = n.hidden; R.seen = n.shown;
      const f = dbg ? null : crew.step(n, dt, R);
      if (!f) { n.fol = null; n.froom = null; n.fy = NaN; n.fpose = 'stand'; return; }
      n.fol = f.mode; n.x = f.x; n.z = f.z; n.h = f.h; n.speed = f.v; n.walking = f.v > 0.1; n.hidden = false; n.spot = 'follow';
      n.froom = f.room; n.fy = f.room ? f.y : NaN; n.fpose = f.pose; n.offX = 0; n.offZ = 0;
    }

    function update(dt) {
      if (!(dt > 0)) dt = 0; else if (dt > 0.1) dt = 0.1;
      const pl = game.player, now = game.time.now(), hour = dbgHour !== null ? dbgHour : game.time.hour, T = dayIdx() * 24 + hour;
      curT = T;
      { const w = performance.now(); if (w >= takenT) { takenT = w + 500; updateTaken(); } }
      const far = rtalkOn(), held = andre.hold || chris.hold || far;
      const talker = far ? game.net.others.get(rtalk.p) : null;
      if (!held) place(T);
      crew.off = !!dbg;
      try { crew.update(dt, hour, T); if (!held) for (const n of npcs) tag(n, dt); } catch (e) { if (!folErr) { folErr = true; console.warn('[keble_pair] follow', e); } }
      // (the player in a walk-in room: their true position is worldPos; the pair is drawn then only when it is with someone)
      const curI = game.interiors && game.interiors.current, pS = curI && curI.sl && pl.place === curI.id && pl.worldPos ? curI.sl : null;
      const pw = pS ? pl.worldPos : pl.pos;
      const W = game.world && game.world.groundHeight ? game.world : null;
      for (const n of npcs) {
        const ch = n.ch, g = ch.group;
        if (n.downT > 0) { n.downT -= dt; if (n.downT <= 0) { n.downT = 0; } }
        const inWorld = pl.place === 'world' || (!!pS && !!n.fol);
        if (held && (n.hold || far)) { n.walking = false; n.speed = 0; const q = far ? (talker && talker.place === 'world' ? talker : null) : pw; if (q) n.h = Math.atan2(q.x - n.x - n.offX, q.z - n.z - n.offZ); }
        // smooth over discontinuities (end of a talk, leaving a stroll mid-way): an offset that decays
        if (n.shown && !dbg && !held && !n.fol) {
          const jx = n.lastX - (n.x + n.offX), jz = n.lastZ - (n.z + n.offZ), j2 = jx * jx + jz * jz;
          if (j2 > 0.3 && j2 < 100) { n.offX += jx; n.offZ += jz; } else if (j2 >= 100) { n.offX = 0; n.offZ = 0; }
        } else if (!n.shown) { n.offX = 0; n.offZ = 0; }
        const k = Math.min(1, dt * 1.1); n.offX -= n.offX * k; n.offZ -= n.offZ * k;
        const x = n.x + n.offX, z = n.z + n.offZ;
        n.lastX = x; n.lastZ = z;
        const dx = pw.x - x, dz = pw.z - z, d = Math.hypot(dx, dz);
        const show = inWorld && !n.hidden && !n.taken && d < VIS_FAR;
        n.shown = show; g.visible = show;
        if (!show) continue;
        // ground (terraces, kerbs): resampled every 0.3 m or 1.5 s, eased
        if ((x - n.gyX) ** 2 + (z - n.gyZ) ** 2 > 0.09 || (n.gyT -= dt) <= 0) {
          n.gyT = 1.5; const jump = !(Math.abs(x - n.gyX) + Math.abs(z - n.gyZ) < 2); n.gyX = x; n.gyZ = z;
          const gh = W ? W.groundHeight(x, z) : 0, gy = Number.isFinite(gh) ? gh : 0; n.gyTo = gy; if (jump) n.gy = gy;
        }
        if (n.gyTo !== undefined) n.gy += (n.gyTo - n.gy) * Math.min(1, dt * 12);
        n.y = n.froom && Number.isFinite(n.fy) ? n.fy : n.gy; n.pos.set(x, n.y, z);
        // solid like the other friends; a bike / car bump knocks them over
        if (d < 1.8 && !ch.isDown && !pS) {
          const v = pl.vehicle;
          if (v && v.kind !== 'punt' && v.kind !== 'glider' && v.kind !== 'chute') {
            if (Math.abs(v.speed || 0) > 2.2 && d < (v.kind === 'car' ? 1.7 : 0.85) && now - n.knockT > 1500) {
              n.knockT = now; n.downT = 4.3; ch.setPose('stand'); ch.setPose('fall'); if (v.kind === 'bike') v.speed *= 0.4; else v.speed *= 0.7;
            }
          } else if (!v && d < 0.62 && d > 1e-4) {
            const push = 0.62 - d; pl.pos.x += (dx / d) * push; pl.pos.z += (dz / d) * push; game.collider.resolve(pl.pos, pl.radius || 0.32);
          }
        }
        // (drawn at a world heading that turns smoothly; inside a walk-in room — tagging along — in that room's scene)
        { let dh = n.h - n.hs; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); n.hs += dh * Math.min(1, dt * 7); }
        const I = game.interiors;
        if (n.froom && I && I.place) I.place(g, x, n.y, z, n.hs);
        else { if (g.parent !== scene) scene.add(g); g.position.set(x, n.y, z); g.rotation.y = n.hs; }
        const down = n.downT > 0;
        const pose = down ? 'fall' : held && (n.hold || far) ? 'talk' : n.fol ? n.fpose : n.walking ? 'stand' : n.id === 'chris' ? 'talk' : 'stand';
        if (ch.pose !== pose && !(ch.poseDur && (ch.pose === 'wave' || ch.pose === 'clap')) && !(ch.pose === 'fall' && down)) ch.setPose(pose);
        // Andre waves when someone he hasn't seen for a while comes up (no words: his only lines are his catchphrases)
        n.greetT -= dt;
        const close = d < 5 && !n.hold && !down;
        if (n === andre && close && !n.near && n.greetT <= 0 && !n.walking && !game.ui.inDialog) { n.greetT = 90; ch.setPose('wave', { duration: 1.6 }); }
        n.near = close;
        ch.headTurn(close && !n.walking ? Math.max(-1.2, Math.min(1.2, Math.atan2(Math.sin(Math.atan2(dx, dz) - n.hs), Math.cos(Math.atan2(dx, dz) - n.hs)))) : 0);
        if (d < ANIM_FAR) ch.update(dt, down || (held && (n.hold || far)) ? 0 : n.fol ? Math.min(n.speed, GAIT_MAX) : n.speed); else if (ch.lodTick) ch.lodTick();
      }
      speech(now);
    }

    // ---- speech on the shared clock
    function speech(now) {
      // (busy = someone is talking to them, here or on another client: the same answer everywhere — not "a box is open on OUR screen")
      const A = andre, C = chris, busy = A.hold || C.hold || rtalkOn();
      const any = A.shown || C.shown;
      const cx = A.shown ? A.pos.x : C.pos.x, cz = A.shown ? A.pos.z : C.pos.z;
      for (let i = pending.length - 1; i >= 0; i--) {
        const q = pending[i]; if (now < q.at) continue;
        pending.splice(i, 1);
        if (!busy && now - q.at < 3000) bubble(byId.get(q.who), q.text);
      }
      const k = Math.floor(now / (SLOT_S * 1000));
      if (!any) { slotK = null; walkN = 0; return; }
      const nearN = playersNear(game, 'world', cx, cz, WALKUP_R);
      if (nearN > walkN && now - walkT > WALKUP_COOL_MS && A.shown && !busy && !A.ch.isDown) { walkT = now; bubble(A, walkupLine(Math.floor(now / 60000)), true); }
      walkN = nearN;
      if (k === slotK) return;
      const late = now - k * SLOT_S * 1000 > 2500; slotK = k;
      if (late) return;                                    // (came into view part-way through a slot: its line is not said late)
      if (busy || playersNear(game, 'world', cx, cz, NEAR_R) === 0) return;
      const ev = slotEvent(k); if (!ev) return;
      const t0 = k * SLOT_S * 1000;
      for (const [who, text, delay] of ev) {
        const n = byId.get(who); if (!n || !n.shown || n.ch.isDown) continue;
        if (delay) pending.push({ at: t0 + delay * 1000, who, text });
        else bubble(n, text);
      }
      // now and then Andre laughs at one of Chris's lines (a little clap, no words)
      if (ev.length === 1 && ev[0][0] === 'chris' && hash01(k * 3.3) < 0.4 && A.shown && !A.walking) setTimeout(() => { if (A.shown && !A.ch.saying) A.ch.setPose('clap', { duration: 1.3 }); }, 2200);
    }

    game.kebleFriends = {
      npcs, spots: S, voices,
      whereIs(id) { const n = byId.get(id); return n && { id, x: n.x + n.offX, y: n.y, z: n.z + n.offZ, spot: n.spot, hidden: n.hidden, walking: n.walking, shown: n.shown, taken: n.taken, place: n.hidden ? null : 'world', following: n.fol === 'follow' ? crew.following(id) : null, returning: n.fol === 'return' }; },
      follow: crew,
      plan: (day = dayIdx()) => dayPlan(day).map((e) => ({ ...e, h0: +(e.t0 - day * 24).toFixed(2), h1: +(e.t1 - day * 24).toFixed(2) })),
      routeOf: (a, b) => { const R = routeOf(a, b); return { len: R.len, n: R.xs.length }; },
      debugHour(h) { dbgHour = h; },
      debugLineup(x, z, h = 0) { dbg = { x, z, h }; },
      debugOff() { dbg = null; dbgHour = null; },
    };
    return { update };
  },
};
