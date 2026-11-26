// Purple Turtle — walking someone home. They lead; you follow on foot through the real streets with the ordinary
// controls, to the college lodge or house door where they live (the same doors the club's other couples go home to:
// _pt_routes.js). The skill is the plain one: walk beside them, not on their heels; do not sprint off or dawdle; do not
// get lost when they turn into a lane; take their arm when they say they are cold; chips at the van if they fancy
// them; say something decent when they talk. At the door it ends on the step: a goodnight — a kiss on the cheek if the
// walk went well — and they go in and the door shuts. Nothing else. Then the glow (_pt_fx.js love()).
// Rules: _pt_social_logic.js (newWalk, walkStep, WALK_CHAT, doorstep).
import * as Lg from './_pt_logic.js';
import * as So from './_pt_social_logic.js';
import { buildRoute, VAN } from './_pt_routes.js';
import { makeChar, freeChar, couplePose, holdTweak, cheekTweak, chipsTweak, chipsBox } from './_pt_chars.js';
import { personaLook } from './_pt_social.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const SAY = {
  out: ['This way. Keep up!', "It's not far."], heel: ['Ow — my HEEL.', 'You are ON my heels.', 'Walk BESIDE me, you muppet.'], sprint: ['Is this a race?', 'Training for Torpids, are we?'],
  lag: ['Keep up!', 'Are you coming or not?', 'Hello? This way!'], ahead: ['Other way, genius!', 'You do not know where I live. Come back.'], lost: ['Well. Night, then!'],
  vehicle: ['Did you just NICK that? Goodnight!'], indoors: ["I'm not waiting out here. Night!"], cold: ["It's FREEZING. Give me your arm?"], linked: ['Better.', 'Much better.'], unlink: ['Oi — come back, you were warm.'],
  down: ['Oh my god — are you OK?!'], van: ['Cheesy chips? Go on.'], near: ['Nearly there.', 'Just round here.'], here: ['Well. This is me.'], close: ['Easy, tiger.'],
  kiss: ['I had a really good night.', 'Night, {name}. Find me at the Turtle tomorrow?'], warm: ['Thanks for walking me back. That was really nice. Night!'], flat: ['Right. Well. Thanks. Night.'], shy: ['Shy! Night, you.'], wave: ['Night, then!'],
};
const one = (L, k) => L[Math.abs(Math.floor(k)) % L.length];

export function createWalkHome(game, pt, street, audio, strip, fx) {
  const H = { w: null, routes: null, remote: new Map(), netT: 0, last: null };
  const scene = game.worldScene;
  const gh = (x, z) => (game.world && game.world.groundHeight ? game.world.groundHeight(x, z) : 0);
  const say = (w, t, s = 2.8) => { try { w.ch.say(t, s); } catch { /* */ } };
  const meSay = (t, s = 2.2) => { try { game.player.character.say(t, s); } catch { /* */ } };

  /** every door someone might live behind, with the walk to it (worked out once) */
  function routes() {
    if (H.routes) return H.routes;
    const c = street.ctx(); const out = [];
    c.dests.forEach((d, i) => { try { const r = buildRoute(c, { dest: i, chips: false, kiss: false, couple: true, speed: So.WALK.pace }); const len = r.cum[r.cum.length - 1]; if (r.dest && len > 120 && len < 720) out.push({ i, d, len }); } catch { /* */ } });
    if (!out.length) c.dests.forEach((d, i) => out.push({ i, d, len: 0 }));
    return (H.routes = out);
  }
  H.destFor = (P) => {
    const R = routes(); if (!R.length) return null;
    const q = R[P.home % R.length], n = q.d.name;
    const phrase = q.d.kind === 'house' ? 'on ' + n.replace(/^[\d\- ]+/, '') : 'at ' + n.replace(/ lodge$| College.*$|,.*$| \(.*$/g, '');
    return { i: q.i, name: n, phrase, len: q.len };
  };
  H.begin = (P, C, look, cupKind) => {
    if (H.w) end();
    const c = street.ctx(), D = H.destFor(P);
    const vanOpen = !!(pt.st && pt.st.vanOpen) && c.vanNode >= 0;
    const r = buildRoute(c, { dest: D ? D.i : 0, chips: P.chips && vanOpen, kiss: false, couple: true, speed: So.WALK.pace });
    const total = r.cum[r.cum.length - 1], chipsStop = r.stops.find((s) => s.tag === 'chips'), doorStop = r.stops.find((s) => s.tag === 'fumble');
    const w = { P, C, D: r.dest, name: D ? D.name : 'home', r, total, s: 0, sWait: Math.min(6, r.cum[Math.min(3, r.cum.length - 1)] * 0.4), sChips: chipsStop ? chipsStop.s : -1, sDoor: doorStop ? doorStop.s : total,
      ch: makeChar(look || personaLook(P, 0.4), scene), x: r.pts[0][0], z: r.pts[0][1], y: 0, h: 0, speed: 0, phase: 'out', t: 0, m: So.newWalk(C.spark), said: {}, chat: 0, side: 1, linkT: 0, tw: null, pose: 'stand', door: 0, kiss: 0, o: {} };
    w.ch.lookAtPlayer = false; w.ch.setLabel(P.name);
    w.sLink = Math.min(total * 0.22, 60) + w.sWait; w.sChat = [0.4, 0.62, 0.84].map((f) => f * w.sDoor);
    H.w = w; H.last = null;
    return { dest: w.name, len: Math.round(total), chips: w.sChips >= 0 };
  };
  function end() { const w = H.w; if (!w) return; freeChar(w.ch); if (w.chips) w.chips.removeFromParent(); H.w = null; unlink(w, true); if (strip.tag === 'walk' || strip.tag === 'van') strip.close(); }
  function unlink(w, quiet) { if (!w.m.linked) return; w.m.linked = false; const p = game.player; if (p.pose === 'arm-in-arm') p.pose = 'stand'; if (!quiet) say(w, SAY.unlink[0]); }
  function fail(w, why) { w.phase = 'alone'; H.last = { result: 'fail', why }; unlink(w, true); if (strip.tag === 'walk' || strip.tag === 'van') strip.close(); w.ch.setLabel(null); }
  function place(w, s) { const o = Lg.pointAt(w.r.pts, w.r.cum, s, w.o); w.x = o.x; w.z = o.z; return o.h; }

  function tick(w, dt) {
    const p = game.player, P = w.P, m = w.m, world = p.place === 'world';
    const px = world ? p.pos.x : p.worldPos.x, pz = world ? p.pos.z : p.worldPos.z;
    const dx = px - w.x, dz = pz - w.z, d = Math.hypot(dx, dz);
    const fx_ = Math.sin(w.h), fz = Math.cos(w.h), ahead = dx * fx_ + dz * fz, lateral = dx * fz - dz * fx_;       // lateral > 0: you are on their left
    w.t += dt; w.tw = null; w.pose = 'stand'; let v = 0, faceH = null;
    if (S_auto() && world && (w.phase === 'walk' || w.phase === 'door' || w.phase === 'van')) {        // (test hook: walk at their side)
      const tx = w.x + fz * 0.72 - fx_ * (w.phase === 'door' ? -1.35 : 0.05), tz = w.z - fx_ * 0.72 - fz * (w.phase === 'door' ? -1.35 : 0.05);
      if (w.phase === 'door') { p.pos.x += (w.x + fx_ * 1.3 - p.pos.x) * Math.min(1, dt * 3); p.pos.z += (w.z + fz * 1.3 - p.pos.z) * Math.min(1, dt * 3); } else { p.pos.x += (tx - p.pos.x) * Math.min(1, dt * 4); p.pos.z += (tz - p.pos.z) * Math.min(1, dt * 4); }
      p.pos.y = gh(p.pos.x, p.pos.z); p.heading = w.phase === 'door' ? Math.atan2(w.x - p.pos.x, w.z - p.pos.z) : w.h; p.vx = p.vz = 0; p.speed = w.phase === 'walk' ? w.speed : 0; p.syncMesh();
    }
    if (w.phase === 'out') {
      // out of the club door and a few steps along Frewin Court; waits there for you
      if (w.s < w.sWait) { v = So.WALK.pace; }
      else { faceH = Math.atan2(dx, dz); if (world && d < 10) { w.phase = 'walk'; say(w, one(SAY.out, P.seed)); } else if (w.t > 75) { fail(w, 'stood up'); } else if (!w.said.wait && w.t > 14) { w.said.wait = 1; say(w, 'Are you coming?'); } }
    } else if (w.phase === 'walk' || w.phase === 'alone') {
      const alone = w.phase === 'alone';
      if (!alone) {
        const ev = So.walkStep(m, dt, { d, behind: -ahead, lateral, ahead, speed: p.speed, moving: w.speed > 0.3, vehicle: !!p.vehicle, place: p.place, down: !!p.down });
        for (const e of ev) { H.last = { ev: e, mood: +m.mood.toFixed(2) }; if (d < 40 || e === 'lag') say(w, one(SAY[e] || SAY.lag, m.heels + m.calls + w.chat), 3); if (m.over) { fail(w, m.over); return; } }
        if (p.down && d < 12 && !w.said.down) { w.said.down = 1; say(w, SAY.down[0]); }
      }
      // waits if you have fallen behind; otherwise their own pace
      const waiting = !alone && d > So.WALK.lag && ahead < 2;
      v = waiting ? 0 : alone ? 1.6 : So.WALK.pace;
      if (waiting) faceH = Math.atan2(dx, dz);
      if (!alone && w.sChips >= 0 && w.s >= w.sChips && !w.said.van) { w.phase = 'van'; w.said.van = 1; w.t = 0; return; }
      if (w.s >= w.sDoor - 0.02) { w.phase = alone ? 'in' : 'door'; w.t = 0; return; }
      if (!alone) {
        // an arm, when they are cold: walk in beside them and they take it
        if (!w.said.cold && w.s > w.sLink && !strip.open) { w.said.cold = 1; w.linkOffer = 14; say(w, SAY.cold[0], 3.5); }
        const beside = Math.abs(lateral) > 0.3 && Math.abs(lateral) < 1.05 && Math.abs(ahead) < 0.7;
        if (w.linkOffer > 0 && !m.linked) { w.linkOffer -= dt; w.linkT = beside ? w.linkT + dt : 0; if (w.linkT > 0.7) { m.linked = true; w.side = lateral > 0 ? 1 : -1; m.mood = clamp(m.mood + 0.06, 0, 1); say(w, one(SAY.linked, P.seed), 2); audio.spark(); } }
        if (m.linked) {
          if (d > 1.5 || p.vehicle || !world) unlink(w);
          else { w.side = lateral > 0 ? 1 : -1; if (!couplePose(w.ch, 'arm', w.side)) w.tw = (c) => holdTweak(c, w.side, 'arm'); w.pose = null; p.pose = 'arm-in-arm'; p.character.partnerSide = -w.side; }
        }
        // falling into step: near them you walk at their pace (run and you leave them behind)
        if (d < 1.9 && world && !game.input.run && !p.vehicle) { const sp = Math.hypot(p.vx, p.vz), cap = Math.max(v, 0.2) * 1.14 + (ahead < -0.6 ? 0.5 : 0); if (sp > cap) { p.vx *= cap / sp; p.vz *= cap / sp; } }
        // something to say on the way
        if (w.chat < w.sChat.length && w.s > w.sChat[w.chat] && !strip.open && d < 5) {
          const q = So.WALK_CHAT[(P.seed + w.chat) % So.WALK_CHAT.length], k = w.chat++; say(w, q.she, 4);
          const order = [0, 1, 2].sort((a, b) => Lg.hash('wo', P.seed, k, a) - Lg.hash('wo', P.seed, k, b));
          w.ask = { t: 1.2, q, order };
        }
        if (w.ask) { w.ask.t -= dt; if (w.ask.t <= 0) { const { q, order } = w.ask; w.ask = null; strip.show('walk', null, order.map((i) => q.opts[i][1]), 9, (i) => { const o = i === null ? null : q.opts[order[i]]; if (o) meSay(o[1]); const r = So.onWalkChat(P, m, o ? o[0] : null); H.last = { chat: o ? o[0] : null, good: r.good, mood: +m.mood.toFixed(2) }; w.reply = { t: o ? 1.4 : 0.2, text: r.reply }; }); } }
        if (w.reply) { w.reply.t -= dt; if (w.reply.t <= 0) { say(w, w.reply.text); w.reply = null; } }
        if (!w.said.near && w.s > w.sDoor - 45 && w.s > w.sChat[2] + 8) { w.said.near = 1; say(w, one(SAY.near, P.seed)); }
      }
      if (w.chips) { const prev = w.tw; w.tw = (c) => { if (prev) prev(c); chipsTweak(c, w.t, !m.linked); }; }
    } else if (w.phase === 'van') {
      const vs = VAN.spot(0); w.x += (vs[0] - w.x) * Math.min(1, dt * 3); w.z += (vs[1] - w.z) * Math.min(1, dt * 3); faceH = VAN.face; unlink(w, true);
      if (!w.said.vanAsk && (d < 4.5 || w.t > 12)) {
        w.said.vanAsk = 1; say(w, SAY.van[0], 3.5);
        strip.show('van', null, ['My treat. (£2.50)', 'Go halves?', 'Not for me, thanks.'], 9, (i) => {
          if (i === 0 && game.pay(-2.5)) { meSay('My treat.'); m.mood = clamp(m.mood + 0.08, 0, 1); w.reply = { t: 1.2, text: 'My hero.' }; audio.coin(); }
          else if (i === 1 && game.pay(-1.25)) { meSay('Go halves?'); m.mood = clamp(m.mood + 0.04, 0, 1); w.reply = { t: 1.2, text: 'Deal.' }; audio.coin(); }
          else { if (i === 2) meSay('Not for me, thanks.'); w.reply = { t: 1.0, text: i === null ? 'Suit yourself.' : 'More for me.' }; }
          w.vanDone = w.t + 4;
        });
      }
      if (w.reply) { w.reply.t -= dt; if (w.reply.t <= 0) { say(w, w.reply.text); w.reply = null; } }
      if (w.vanDone && w.t > w.vanDone) { w.chips = chipsBox(); w.chips.rotation.x = Math.PI / 2; w.chips.position.set(0, 0.03, -0.06); w.ch.anchors.handL.add(w.chips); w.phase = 'walk'; w.s += 0.05; }
      else if (w.t > 40) { w.phase = 'walk'; }
    } else if (w.phase === 'door') {
      // on the step, facing the street: come and stand with them
      const D = w.D, out = D ? D.out : [fx_, fz]; faceH = d < 6 ? Math.atan2(dx, dz) : Math.atan2(out[0], out[1]); unlink(w, true);
      if (!w.said.here && d < 7) { w.said.here = 1; say(w, SAY.here[0], 3); }
      if (d < 0.5 && !w.said.close) { w.said.close = 1; m.mood = clamp(m.mood - 0.05, 0, 1); say(w, SAY.close[0], 2); }
      w.still = d > 0.7 && d < 2.6 && p.speed < 0.5 && world ? (w.still || 0) + dt : 0;
      if (w.still > 1.3 && w.said.here) { w.result = So.doorstep(m); w.phase = 'night'; w.t = 0; }
      else if (w.t > 28) { w.result = So.doorstep(m) === 'flat' ? 'flat' : 'wave'; w.phase = 'night'; w.t = 0; }
    } else if (w.phase === 'night') {
      faceH = Math.atan2(dx, dz);
      const res = w.result, name = p.name && p.name !== 'Fresher' ? p.name : 'you';
      if (res === 'kiss') {
        if (!w.said.k0) { w.said.k0 = 1; say(w, SAY.kiss[0], 2.8); }
        if (w.t > 2.4 && w.kiss === 0) {
          // they step in; if you back away, they laugh and leave it at a wave
          if (d > 2.9) { w.result = 'shy'; w.t = 0; return; }
          const k = Math.min(1, dt * 2.2), tx = px - (dx / d) * 0.46, tz = pz - (dz / d) * 0.46; w.x += (tx - w.x) * k; w.z += (tz - w.z) * k; w.speed = 0.4;
          if (d < 0.62) { w.kiss = 0.001; audio.spark(); }
        } else if (w.kiss > 0) {
          w.kiss += dt; const a = Math.sin(Math.PI * clamp(w.kiss / 1.5, 0, 1)); w.tw = (c) => cheekTweak(c, a, 1); cheekTweak(p.character, a * 0.5, 1);
          if (w.kiss > 0.75 && !w.said.mark) { w.said.mark = 1; fx.love('kiss', P); }
          if (w.kiss > 1.5 && !w.said.k1) { w.said.k1 = 1; say(w, SAY.kiss[1].replace('{name}', name), 3.4); }
          if (w.kiss > 4.2) { w.phase = 'in'; w.t = 0; H.last = { result: 'kiss', mood: +m.mood.toFixed(2) }; }
        }
      } else {
        if (!w.said.n) { w.said.n = 1; say(w, one(SAY[res] || SAY.wave, 0), 3.4); if (res === 'warm' || res === 'shy') { fx.love('warm', P); w.ch.setPose('wave', { duration: 1.8 }); } }
        if (w.t > 3.2) { w.phase = 'in'; w.t = 0; H.last = { result: res, mood: +m.mood.toFixed(2) }; }
      }
    } else if (w.phase === 'in') {
      // the door opens, they go in, it shuts. That is the end of it.
      const D = w.D; w.door = 1;
      if (D) { const tx = D.door[0] - D.out[0] * 1.0, tz = D.door[1] - D.out[1] * 1.0, mx = tx - w.x, mz = tz - w.z, md = Math.hypot(mx, mz);
        if (w.t > 0.9) { const s = Math.min(md, 1.1 * dt); if (md > 0.05) { w.x += (mx / md) * s; w.z += (mz / md) * s; w.speed = 1.1; faceH = Math.atan2(mx, mz); } if (md < 0.12 || w.t > 6) { w.phase = 'shut'; w.t = 0; } }
      } else if (w.t > 2) { w.phase = 'shut'; w.t = 0; }
    } else if (w.phase === 'shut') { w.door = 0; w.hidden = true; if (w.t > 2.5) { if (H.last && H.last.result) { game.state.ptSweet = { name: P.name, night: P.night, key: P.key }; game.save && game.save(); } end(); return; } }
    // along the route
    if (v > 0 && (w.phase === 'out' || w.phase === 'walk' || w.phase === 'alone')) { w.s = Math.min(w.sDoor, w.s + v * dt); const h = place(w, w.s); w.h += wrapA(h - w.h) * Math.min(1, dt * 6); w.speed = v; }
    else if (w.phase !== 'night' && w.phase !== 'in') w.speed = 0;
    if (faceH !== null && w.speed < 0.2 || (faceH !== null && w.phase === 'in')) w.h += wrapA(faceH - w.h) * Math.min(1, dt * 5);
    if (w.D && !w.D.noLeaf && (w.phase === 'door' || w.phase === 'night' || w.phase === 'in' || w.phase === 'shut')) street.useDoor(w.D, w.door, dt);
    // draw
    const g = w.ch.group; g.visible = !w.hidden && d < 130;
    if (g.visible) { w.y = gh(w.x, w.z); g.position.set(w.x, w.y, w.z); g.rotation.y = w.h; if (w.pose && w.ch.pose !== w.pose && w.ch.pose !== 'wave') w.ch.setPose(w.pose); w.ch.update(dt, w.speed); if (w.tw) w.tw(w.ch); }
  }
  const S_auto = () => !!(pt.social && pt.social.auto.walk) || !!H.auto;

  // ------------------------------------------------------------------ other players' walks home (seen, not played)
  const net = game.net;
  if (net && net.on) net.on('ptw', (d, o) => {
    if (!d || !o || !Number.isFinite(d.x) || !Number.isFinite(d.z)) return;
    let R = H.remote.get(o.id);
    if (d.end) { if (R) { freeChar(R.ch); H.remote.delete(o.id); } return; }
    if (!R || R.k !== d.k || R.n !== d.n) { if (R) freeChar(R.ch); const P = So.personasFor(d.n, d.k[0] === 'm' ? 'm' : 'f')[+d.k[1] || 0]; if (!P) return; R = { k: d.k, n: d.n, ch: makeChar(personaLook(P, 0.4), scene), x: d.x, z: d.z, h: d.h || 0, sp: 0 }; R.ch.setLabel(P.name); H.remote.set(o.id, R); }
    R.tx = d.x; R.tz = d.z; R.th = d.h || 0; R.sp = d.v || 0; R.pose = d.p || 'stand'; R.side = d.s || 1; R.hid = !!d.hid; R.t = performance.now();
  });
  H.update = (dt) => {
    const w = H.w;
    if (w) { try { tick(w, dt); } catch (e) { if (!H._err) console.error('[purple_turtle] walk home', e); H._err = true; end(); } }
    if (net && net.connected && (H.netT -= dt) <= 0) { H.netT = 0.2; const q = H.w; if (q) net.send('ptw', { n: q.P.night, k: q.P.key, x: +q.x.toFixed(2), z: +q.z.toFixed(2), h: +q.h.toFixed(2), v: +q.speed.toFixed(2), p: q.ch.pose, s: q.side, hid: !!q.hidden }); else if (H.sent) net.send('ptw', { end: 1, x: 0, z: 0 }); H.sent = !!q; }
    for (const [id, R] of H.remote) {
      if (performance.now() - R.t > 4000) { freeChar(R.ch); H.remote.delete(id); continue; }
      const k = Math.min(1, dt * 6); R.x += (R.tx - R.x) * k; R.z += (R.tz - R.z) * k; R.h += wrapA(R.th - R.h) * k;
      const g = R.ch.group; g.visible = !R.hid; if (!g.visible) continue; g.position.set(R.x, gh(R.x, R.z), R.z); g.rotation.y = R.h;
      if (R.pose === 'arm-in-arm') couplePose(R.ch, 'arm', R.side); else if (R.ch.pose !== R.pose) R.ch.setPose(R.pose);
      R.ch.update(dt, R.sp);
    }
  };
  H.state = () => { const w = H.w; return w ? { name: w.P.name, phase: w.phase, dest: w.name, s: +w.s.toFixed(1), of: +w.sDoor.toFixed(1), mood: +w.m.mood.toFixed(2), linked: !!w.m.linked, x: +w.x.toFixed(1), z: +w.z.toFixed(1), h: +w.h.toFixed(2), chips: w.sChips >= 0 ? +w.sChips.toFixed(0) : null, result: w.result || null, last: H.last } : { phase: null, last: H.last }; };
  /** test hook: jump them (and you, at their side) to `s` metres along the route, or `back` metres before the door */
  H.skip = (s, back = null) => { const w = H.w; if (!w) return null; w.s = clamp(back !== null ? w.sDoor - back : s, 0, w.sDoor - 0.5); if (w.phase === 'out') w.phase = 'walk'; for (let i = 0; i < w.sChat.length; i++) if (w.sChat[i] < w.s) w.chat = Math.max(w.chat, i + 1); const h = place(w, w.s); w.h = h; const p = game.player; if (p.place === 'world') p.teleport(w.x + Math.cos(h) * 0.75, w.z - Math.sin(h) * 0.75, h); return H.state(); };
  H.end = end;
  return H;
}
