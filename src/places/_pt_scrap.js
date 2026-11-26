// Purple Turtle — trouble: tonight's rival (an invented regular of your own sex, pint in hand, wandering between the bar
// and the floor), cutting in on a dance, a spilt pint, squaring up, and the scrap itself — a shoving match you control
// with the ordinary movement keys plus F (shove), R held (forearms up), E (grab hold); stepping aside makes them miss.
// Comic and bloodless: nobody is hurt, people sit down hard and get up again, and it always ends with the bouncers,
// who throw out whoever was swinging. Saying sorry (or just walking away) always ends it sooner.
// Rules: _pt_social_logic.js (Scrap, onScrap, PROVOKE).
import * as Lg from './_pt_logic.js';
import * as So from './_pt_social_logic.js';
import { LAY } from './_pt_interior.js';
import { randomLook } from '../core/characters.js';
import { makeChar, freeChar, bouncerLook, earpiece, windupTweak, shoveTweak, blockTweak, staggerTweak, clinchTweak, escortTweak, palmsTweak, moveTweak } from './_pt_chars.js';
import { ID, onFloor } from './_pt_social.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const PATROL = [[2.3, -2.5], [2.0, -0.6], [2.9, 1.5], [2.9, 5.2], [5.2, 4.6], [3.6, -1.6]];
const pick = (L, k) => L[Math.floor(Lg.hash('pk', k, L.length) * L.length) % L.length];

export function createScrap(game, pt, scene, col, audio, strip, S) {
  const X = { rival: null, cut: null, cutDone: false, prov: null, fight: null, bouncers: [], night: null, warned: false, grudge: false, grudgeDone: false, out: null, last: null };
  const flags = () => (game.state.flags = game.state.flags || {});
  const say = S.say, meSay = S.meSay, go = S.go, face = S.face;
  const pl = () => game.player;
  const dTo = (m) => Math.hypot(m.x - pl().pos.x, m.z - pl().pos.z);

  function spawn(st) {
    if (X.rival) { freeChar(X.rival.ch); if (X.rival.cup) X.rival.cup.removeFromParent(); }
    for (const b of X.bouncers) freeChar(b.ch); X.bouncers.length = 0;
    X.night = st.night; X.sex = S.sex; X.cut = null; X.cutDone = false; X.prov = null; X.fight = null; X.warned = false; X.grudge = false; X.grudgeDone = false; X.out = null;
    const R = So.rivalFor(st.night, S.sex || 'm');
    const Lk = randomLook(R.seed, { outfit: 'clubbing', range: S.sex === 'f' ? 'womens' : 'mens', theme: 'none', state: Math.min(0.5, st.state) }); Lk.prop = null; if (Lk.club) Lk.club.carry = 'none';
    const m = { ...R, R, ch: makeChar(Lk, scene), x: 8.4, z: -3.3, y: 0, h: -Math.PI / 2, speed: 0, on: false, gone: false, pose: 'stand', tweak: null, act: null, actT: 0, rival: true, kx: 0, kz: 0 };
    m.ch.lookAtPlayer = false; m.ch.group.visible = false; m.cup = pt.makeCup('pint'); m.ch.anchors.handR.add(m.cup);
    X.rival = m;
  }
  function bouncersIn() {
    if (X.bouncers.length) return;
    for (const [i, seed] of [[0, 11], [1, 24]]) { const b = { ch: makeChar(bouncerLook(seed), scene), x: 9.4 + i * 0.9, z: -3.3, y: 0, h: -Math.PI / 2, speed: 0, i, job: null }; earpiece(b.ch); b.ch.lookAtPlayer = false; X.bouncers.push(b); }
  }
  function bouncersOut() { for (const b of X.bouncers) b.job = 'leave'; }

  // ------------------------------------------------------------------ cutting in
  X.onDanceBeat = (A, st, { q, match }) => {
    const r = X.rival, C = A.C; if (!r || !r.on || r.gone || X.fight || X.prov) return;
    if (!X.cut) {
      if (!X.cutDone && C.spark >= 50 && A.dn.beats >= 16 && A.dn.beats % 8 === 0 && Lg.hash('cut', st.night, A.key) < 0.75) { X.cutDone = true; X.cut = { A, beats: 0, mine: 0, his: 0, facing: 'me', said: false }; }
      return;
    }
    const c = X.cut; if (c.A !== A) return;
    if (!c.said) { if ((c.wait = (c.wait || 0) + 1) > 24) X.cut = null; return; }      // (it starts when he has shimmied in beside them)
    c.beats++; if (q && q !== 'off' && match) c.mine++; if (Lg.hash('rv', st.night, c.beats) < r.dance) c.his++;
    if (c.beats % 4 === 0) c.facing = c.his > c.mine ? 'him' : 'me';
    if (c.beats >= 16) {
      const won = c.mine >= c.his; So.onCutIn(A.P, A.C, won); X.cut = null; X.last = { cut: won ? 'won' : 'lost', mine: c.mine, his: c.his };
      if (won) { say(A, So.PROVOKE.cutWon[0], 2.6); r.say2 = { text: So.PROVOKE.cutWon[1], t: 1.6 }; X.grudge = true; r.sulk = st.T + 14000; }
      else { say(A, So.PROVOKE.cutLost[0], 2.4); r.say2 = { text: So.PROVOKE.cutLost[1], t: 1.4 }; r.with = { A, until: st.T + 18000 }; A.hold = st.T + 18000; A.spot = 'floor'; S.stopDance(A, st, null); }
    }
  };

  // ------------------------------------------------------------------ squaring up
  X.provoke = (reason, fault = 'me') => {
    const r = X.rival; if (!r || !r.on || r.gone || X.fight || X.prov || X.out) return false;
    X.prov = { reason, fault, t: 0, said: false }; X.cut = null; r.with = null;
    return true;
  };
  function provTick(dt, st) {
    const r = X.rival, v = X.prov, p = pl(), d = dTo(r);
    v.t += dt; r.pose = 'stand';
    if (d > 1.5) go(r, p.pos.x, p.pos.z, 1.9, dt); else { r.speed = 0; S.faceTo(r, p.pos.x, p.pos.z, dt, 8); }
    if (!v.said && d < 3.5) {
      v.said = true; say(r, pick(So.PROVOKE[v.reason] || So.PROVOKE.barge, st.night + v.reason.length), 3);
      const mine = v.fault === 'me';
      strip.show('provoke', null, mine ? [So.PROVOKE.sorry[0], `${So.PROVOKE.pint[0]} (£${Lg.DRINKS.pint.price.toFixed(2)})`, 'Square up.'] : [So.PROVOKE.leave[0], So.PROVOKE.owe[0], 'Square up.'], 7, (i) => {
        if (!X.prov) return; const far = dTo(r) > 4.5;
        if (i === 0) { meSay(mine ? So.PROVOKE.sorry[0] : So.PROVOKE.leave[0]); r.say2 = { text: mine ? So.PROVOKE.sorry[1] : So.PROVOKE.walk[0], t: 1.3 }; endProv('calm'); }
        else if (i === 1 && mine) { if (game.pay(-Lg.DRINKS.pint.price)) { meSay(So.PROVOKE.pint[0]); r.say2 = { text: So.PROVOKE.pint[1], t: 1.3 }; audio.coin(); endProv('pint'); } else { r.say2 = { text: 'Skint AND clumsy. Brilliant.', t: 0.6 }; endProv('calm'); } }
        else if (i === 1) { meSay(So.PROVOKE.owe[0]); r.say2 = { text: So.PROVOKE.owe[1], t: 1.0 }; startFight('him', st, 1.6); }
        else if (i === 2) { meSay('Come on, then.'); startFight('me', st); }
        else if (far) { say(r, So.PROVOKE.walk[0], 2.4); endProv('walked'); }
        else startFight('him', st);                          // you stood there and said nothing
      });
    }
    if (v.t > 3 && d > 6) { strip.close(); }
  }
  function endProv(how) { X.prov = null; X.last = { provoke: how }; const r = X.rival; r.sulk = (S.st ? S.st.T : 0) + 10000; if (how !== 'walked') X.grudge = false; }
  function startFight(aggressor, st, delay = 0) {
    const r = X.rival; X.prov = null; if (strip.tag === 'provoke') strip.close();
    X.fight = { s: new So.Scrap(`${st.night}|${Math.floor(st.T / 1000)}`, { aggressor, skill: r.skill }), delay, fx: { me: null, him: null }, sit: 0, ring: 2 };
    S.scrap = true; if (S.partner) S.stopDance(S.partner, st, null);
    if (r.cup) { r.cup.removeFromParent(); r.cup = null; }
    bouncersIn(); for (const b of X.bouncers) b.job = 'come';
    if (!S.hint.Scrap) { S.hint.Scrap = 1; try { game.ui.toast('F shove · hold R: forearms up · step aside · E grab hold · or just walk away', 7); } catch { /* */ } }
  }
  X.startFight = (aggressor = 'him') => { if (X.rival && X.rival.on && !X.fight) startFight(aggressor, S.st); };
  function fightTick(dt, st) {
    const Ft = X.fight, s = Ft.s, r = X.rival, p = pl(), inp = game.input;
    if (Ft.delay > 0) { Ft.delay -= dt; S.faceTo(r, p.pos.x, p.pos.z, dt, 8); return; }
    const dx = r.x - p.pos.x, dz = r.z - p.pos.z, d = Math.hypot(dx, dz) || 1e-3, ux = dx / d, uz = dz / d;
    const auto = S.auto.scrap;
    const facing = Math.abs(wrapA(Math.atan2(dx, dz) - (auto ? Math.atan2(dx, dz) : game.cameraYaw))) < 0.9;
    const side = Math.abs(p.vx * uz - p.vz * ux);
    let swing = inp.hit('KeyF') || (inp.clicked && inp.locked), block = inp.down('KeyR'), grapple = inp.hit('KeyE');
    if (grapple) inp.pressed.delete('KeyE');
    if (auto === 'block') block = true;
    if (auto === 'smart') { block = s.opp.s === 'windup' || s.opp.s === 'swing'; swing = s.opp.s === 'recover' || s.opp.s === 'stagger'; }
    if (auto === 'brawl') swing = Lg.hash('br', Math.floor(st.T / 250)) < 0.5;
    const ev = s.step(dt, { swing, block, grapple, dist: d, facing, side });
    // you face the way you look, as on the dance floor
    if (!p.down && p.pose !== 'sitground') p.heading += wrapA((auto ? Math.atan2(dx, dz) : game.cameraYaw) - p.heading) * Math.min(1, dt * 10);
    const at = { x: (r.x + p.pos.x) / 2, y: 1.2, z: (r.z + p.pos.z) / 2, place: ID }, thud = (k) => audio.thud(k, at);      // (the scrap is heard where it is)
    const knock = (m, k) => { m.kx = (m === r ? ux : -ux) * k; m.kz = (m === r ? uz : -uz) * k; };
    for (const e of ev) {
      X.last = { ...(X.last || {}), ev: e };
      if (e === 'windup') { Ft.fx.him = { k: 'windup', t: So.SCRAP.windup, T: So.SCRAP.windup }; if (Lg.hash('wl', s.t) < 0.4) say(r, pick(['RIGHT.', 'Come here!', 'Have that!'], Math.floor(s.t * 10)), 1.2); }
      else if (e === 'heSwings') Ft.fx.him = { k: 'shove', t: 0.3, T: 0.3 };
      else if (e === 'hitMe') { thud(1); p.stumble({ x: -ux, z: -uz }, 0.5); }
      else if (e === 'blocked') { thud(0.5); knock(r, 1.6); Ft.fx.him = { k: 'stagger', t: 0.9, T: 0.9 }; }
      else if (e === 'whiff') { r.kx = -ux * 3.2; r.kz = -uz * 3.2; Ft.fx.him = { k: 'stagger', t: 0.85, T: 0.85 }; say(r, 'WHOA —', 1); }
      else if (e === 'swing') Ft.fx.me = { k: 'shove', t: 0.42, T: 0.42 };
      else if (e === 'hitHim' || e === 'glance' || e === 'shoveHim') { thud(e === 'glance' ? 0.5 : 1); knock(r, e === 'glance' ? 1.2 : 3); if (e !== 'glance') Ft.fx.him = { k: 'stagger', t: 0.7, T: 0.7 }; }
      else if (e === 'heBlocks') { thud(0.4); Ft.fx.him = { k: 'block', t: 0.45, T: 0.45 }; }
      else if (e === 'clinch') { Ft.fx.me = { k: 'clinch', t: 1.8, T: 1.8 }; Ft.fx.him = { k: 'clinch', t: 1.8, T: 1.8 }; }
      else if (e === 'shoveMe') { thud(1); p.stumble({ x: -ux, z: -uz }, 0.6); }
      else if (e === 'oppDown') { thud(1.2); r.pose = 'sitground'; r.sit = 1.5; say(r, pick(['OOF.', 'Ow. My dignity.'], s.opp.downs), 1.6); }
      else if (e === 'oppUp') { r.pose = 'brushoff'; r.brush = 1.0; }
      else if (e === 'meDown') { thud(1.2); if (!Ft.frozen) { Ft.frozen = true; p.frozen++; } p.pose = 'sitground'; Ft.sit = 1.5; game.shake && game.shake(0.3); }
      else if (e === 'meUp') { if (Ft.frozen) { Ft.frozen = false; p.frozen = Math.max(0, p.frozen - 1); } p.pose = 'stand'; }
      else if (e === 'fizzle') { say(r, So.PROVOKE.walk[0], 2.6); endFight(st); return; }
      else if (e === 'bouncers') { endFight(st); return; }
    }
    // him: closing in, circling, knocked about
    r.pose = r.sit > 0 ? 'sitground' : r.brush > 0 ? 'brushoff' : 'stand'; r.sit = Math.max(0, (r.sit || 0) - dt); r.brush = Math.max(0, (r.brush || 0) - dt);
    if (s.clinch) { const tx = p.pos.x + ux * 0.72, tz = p.pos.z + uz * 0.72; r.x += (tx - r.x) * Math.min(1, dt * 8); r.z += (tz - r.z) * Math.min(1, dt * 8); r.speed = 0; }
    else if (s.opp.s === 'circle' && r.sit <= 0) {
      const want = 1.12, c = Math.sin(s.t * 0.9) * 0.5;
      const tx = p.pos.x + (ux * Math.cos(c) - uz * Math.sin(c)) * want, tz = p.pos.z + (uz * Math.cos(c) + ux * Math.sin(c)) * want;
      const mx = tx - r.x, mz = tz - r.z, md = Math.hypot(mx, mz), sp = Math.min(md, 2.1 * dt); if (md > 0.03) { r.x += (mx / md) * sp; r.z += (mz / md) * sp; } r.speed = md > 0.2 ? 1.2 : 0;
    } else r.speed = 0;
    if (r.kx || r.kz) { r.x += r.kx * dt; r.z += r.kz * dt; const k = Math.exp(-dt * 6); r.kx *= k; r.kz *= k; if (Math.abs(r.kx) + Math.abs(r.kz) < 0.05) r.kx = r.kz = 0; }
    { const q = { x: r.x, z: r.z }; try { col.resolve(q, 0.3); } catch { /* */ } r.x = q.x; r.z = q.z; }
    if (r.sit <= 0) S.faceTo(r, p.pos.x, p.pos.z, dt, 10);
    const tw = (fx, t) => !fx ? null : fx.k === 'windup' ? (c) => windupTweak(c, 1 - fx.t / fx.T) : fx.k === 'shove' ? (c) => shoveTweak(c, Math.sin(Math.PI * Math.min(1, (1 - fx.t / fx.T) * 1.3))) : fx.k === 'block' ? blockTweak : fx.k === 'clinch' ? (c) => clinchTweak(c, t) : (c) => staggerTweak(c, t);
    for (const k of ['me', 'him']) { const fx = Ft.fx[k]; if (fx) { fx.t -= dt; if (fx.t <= 0) Ft.fx[k] = null; } }
    r.tweak = r.sit > 0 || r.brush > 0 ? null : tw(Ft.fx.him, s.t);
    if (p.pose !== 'sitground' && !p.down && p.stumbleT <= 0) { const t = Ft.fx.me ? tw(Ft.fx.me, s.t) : s.me.block ? blockTweak : null; if (t) t(p.character); }
    if (Ft.sit > 0) { Ft.sit -= dt; }
    // the ring of people round it
    if ((Ft.ring -= dt) <= 0) { Ft.ring = 2.2 + Math.random() * 1.5; const A = [...S.actors.values()].filter((a) => a.fr.vis && Math.hypot(a.fr.x - r.x, a.fr.z - r.z) < 8)[0]; if (A && !A.fr.ch.saying) say(A.fr, pick(So.PROVOKE.ring, Math.floor(s.t * 3)), 1.8); }
    st.fight = { x: (r.x + p.pos.x) / 2, z: (r.z + p.pos.z) / 2 };
  }
  function endFight(st) {
    const Ft = X.fight, s = Ft.s, r = X.rival, p = pl();
    if (Ft.frozen) { p.frozen = Math.max(0, p.frozen - 1); } if (p.pose === 'sitground') p.pose = 'stand';
    X.fight = null; S.scrap = false; r.tweak = null; r.pose = 'stand'; st.fight = null;
    const out = s.out; X.last = { scrap: s.over, out, swung: s.swung, downs: [s.me.downs, s.opp.downs] };
    // what the person you were getting on with makes of it
    const A = S.engaged && S.engaged.prospect && S.engaged.C.met && !S.engaged.C.over && S.engaged.state !== 'gone' ? S.engaged : null;
    if (A && (A.vis || out.me)) { const v = So.onScrap(A.P, A.C, s); X.last.verdict = v; A.say2 = { text: v.line, t: out.me ? 2.2 : 1.2 }; }
    if (s.over === 'fizzle') { X.bouncers.forEach((b) => { b.job = 'leave'; }); if (X.bouncers[0] && dTo(X.bouncers[0]) < 9) say(X.bouncers[0], So.PROVOKE.bouncer.fizzle, 2.6); X.grudge = false; return; }
    const B = X.bouncers; if (B[0]) say(B[0], out.me ? So.PROVOKE.bouncer.both : So.PROVOKE.bouncer.him, 3.5);
    if (out.him && B[1]) { B[1].job = 'takeHim'; r.out = true; } else if (B[1]) B[1].job = 'leave';
    if (out.me) eject(st, 'scrap'); else if (B[0]) { B[0].job = 'leave'; B[0].wait = 2.5; }
  }
  /** frog-marched up the stairs and out: barred for the night */
  function eject(st, why) {
    const p = pl(); bouncersIn(); const b = X.bouncers[0]; b.job = 'takeMe'; X.out = { why, t: 0 };
    strip.close(); S.leave();
    game.beginActivity({ name: 'pt-out', pointer: 'locked',
      update: (dt) => {
        const o = X.out; if (!o) return; o.t += dt;
        const m = { x: p.pos.x, z: p.pos.z, h: p.heading, speed: 0, path: o.path, pi: o.pi, ptx: o.ptx, ptz: o.ptz };
        const left = o.t < 1.2 ? 9 : go(m, 15.0, -3.3, 2.1, dt); o.path = m.path; o.pi = m.pi; o.ptx = m.ptx; o.ptz = m.ptz;
        p.pos.x = m.x; p.pos.z = m.z; p.pos.y = game.groundHeight(m.x, m.z); p.heading = m.h; p.speed = m.speed; p.syncMesh();
        if (left < 0.25 || o.t > 25) finish();
      },
      onEnd: () => { if (X.out) finish(true); } });
    const finish = (esc) => {
      if (!X.out) return; X.out = null;
      flags().ptBarred = st.night; game.save && game.save();
      if (!esc) game.endActivity();
      p.pose = 'stand';
      Promise.resolve(game.interiors.exit()).catch(() => {}).then(() => { try { game.ui.toast('Thrown out of the Turtle. Barred for the night.', 5); } catch { /* */ } });
      for (const q of X.bouncers) q.job = 'leave';
    };
  }
  X.eject = (why = 'test') => eject(S.st, why);
  /** someone who said no has had enough of you: a word from the bouncer, then the door */
  X.warn = (A) => { bouncersIn(); const b = X.bouncers[0]; if (X.warned) { say(b, So.PROVOKE.bouncer.pest, 3); eject(S.st, 'pest'); return; } X.warned = true; b.job = 'warn'; b.wait = 0; void A; };

  // ------------------------------------------------------------------ other players' trouble (seen, not played)
  // Whoever is squaring up to / scrapping with their rival sends where he and the bouncers are; everyone else in the
  // club draws them there.
  const net = game.net; X.remote = new Map(); X.netT = 0;
  const CODE = { windup: (c) => windupTweak(c, 0.8), shove: (c) => shoveTweak(c, 0.9), block: blockTweak, stagger: (c) => staggerTweak(c, game.elapsed), clinch: (c) => clinchTweak(c, game.elapsed) };
  if (net && net.on) net.on('ptr', (d, o) => {
    if (!d || !o || !Number.isFinite(d.x) || !Number.isFinite(d.z)) return;
    let R = X.remote.get(o.id);
    if (!R) { const Q = So.rivalFor(d.n, d.sx === 'f' ? 'f' : 'm'); const Lk = randomLook(Q.seed, { outfit: 'clubbing', range: d.sx === 'f' ? 'womens' : 'mens', theme: 'none', state: 0.3 }); Lk.prop = null; if (Lk.club) Lk.club.carry = 'none'; R = { ch: makeChar(Lk, scene), x: d.x, z: d.z, h: d.h || 0, b: [] }; R.ch.lookAtPlayer = false; X.remote.set(o.id, R); }
    R.tx = d.x; R.tz = d.z; R.th = d.h || 0; R.pose = d.p || 'stand'; R.f = d.f || null; R.bt = Array.isArray(d.b) ? d.b : []; R.t = performance.now(); R.sx = d.sx;
  });
  function netTick(dt, st) {
    const r = X.rival, busy = !!(X.fight || X.prov || X.cut || (r && r.out && !r.gone) || X.bouncers.length);
    if (net && net.connected && (X.netT -= dt) <= 0) {
      X.netT = 0.2;
      if (busy && r) { const fx = X.fight && X.fight.fx.him ? X.fight.fx.him.k : null; net.send('ptr', { n: st.night, sx: S.sex, x: +r.x.toFixed(2), z: +r.z.toFixed(2), h: +r.h.toFixed(2), p: r.pose, f: fx, b: X.bouncers.map((b) => [+b.x.toFixed(2), +b.z.toFixed(2), +b.h.toFixed(2), +(b.y || 0).toFixed(2)]) }); }
    }
    for (const [id, R] of X.remote) {
      if (performance.now() - R.t > 1500) { freeChar(R.ch); for (const b of R.b) freeChar(b.ch); X.remote.delete(id); continue; }
      const k = Math.min(1, dt * 7); R.x += (R.tx - R.x) * k; R.z += (R.tz - R.z) * k; R.h += wrapA(R.th - R.h) * k;
      // (the same person as my own rival: he is over there, not on his round here)
      if (R.sx === S.sex && r && !busy) { r.x = R.x; r.z = R.z; r.h = R.h; r.pose = R.pose; r.tweak = CODE[R.f] || null; r.speed = 0; R.ch.group.visible = false; X.puppet = true; }
      else { const g = R.ch.group; g.visible = true; g.position.set(R.x, 0, R.z); g.rotation.y = R.h; if (R.ch.pose !== R.pose) R.ch.setPose(R.pose); R.ch.update(dt, 0); if (CODE[R.f]) CODE[R.f](R.ch); }
      while (R.b.length < R.bt.length) { const b = { ch: makeChar(bouncerLook(R.b.length ? 24 : 11), scene), x: R.bt[R.b.length][0], z: R.bt[R.b.length][1], h: 0 }; earpiece(b.ch); R.b.push(b); }
      while (R.b.length > R.bt.length) freeChar(R.b.pop().ch);
      R.b.forEach((b, i) => { const q = R.bt[i], ox = b.x, oz = b.z; b.x += (q[0] - b.x) * k; b.z += (q[1] - b.z) * k; b.h += wrapA(q[2] - b.h) * k; const g = b.ch.group; g.position.set(b.x, q[3] || 0, b.z); g.rotation.y = b.h; b.ch.update(dt, Math.hypot(b.x - ox, b.z - oz) / Math.max(dt, 1e-3)); });
    }
  }

  // ------------------------------------------------------------------ per frame
  X.update = (dt, st) => {
    if (X.night !== st.night || X.sex !== S.sex) spawn(st);
    const r = X.rival, p = pl(), cam = game.camera.position;
    r.tweak = null; X.puppet = false;
    netTick(dt, st);
    if (!r.on && !r.gone && st.open && !st.lightsUp && st.nh >= r.arrive) { r.on = true; const q = PATROL[Math.floor(st.T / 11000) % PATROL.length]; r.x = q[0]; r.z = q[1]; }
    if (r.on && !r.gone) {
      if (r.say2) { r.say2.t -= dt; if (r.say2.t <= 0) { say(r, r.say2.text, 2.6); r.say2 = null; } }
      if (X.puppet) { /* drawn where another player's scrap has him */ }
      else if (r.out || st.lightsUp) { r.pose = 'stand'; if (go(r, 14.8, -3.3, r.out ? 2.0 : 1.2, dt) < 0.2) { r.gone = true; r.on = false; } }
      else if (X.fight) fightTick(dt, st);
      else if (X.prov) provTick(dt, st);
      else if (X.cut) {
        // shimmying in beside your partner
        const A = X.cut.A, c = X.cut, ox = Math.cos(A.h) * 0.95, oz = -Math.sin(A.h) * 0.95, d = Math.hypot(A.x + ox - r.x, A.z + oz - r.z);
        if (d > 0.3) go(r, A.x + ox, A.z + oz, d > 1.5 ? 2.6 : 1.5, dt); else { r.speed = 0; S.faceTo(r, A.x, A.z, dt, 6); } if (d < 0.9 && !c.said) { c.said = true; say(r, So.PROVOKE.cut[0], 2.6); }
        r.pose = d > 0.7 ? 'stand' : 'dance'; const bf = st.beat || 0, b = Math.round(bf); if (d <= 0.7) r.tweak = (ch) => moveTweak(ch, So.partnerMove(A.P, b), Math.cos(Math.PI * (bf - b)) ** 2);
        if (A.state !== 'dance') X.cut = null;
      } else if (r.with && st.T < r.with.until) { const A = r.with.A; const d = Math.hypot(A.x + 1.0 - r.x, A.z - r.z); if (d > 0.25) go(r, A.x + 1.0, A.z, 1.4, dt); else { r.speed = 0; S.faceTo(r, A.x, A.z, dt, 6); } r.pose = d > 0.4 ? 'stand' : 'dance'; S.faceTo(A, r.x, r.z, dt, 3); }
      else {
        r.with = null;
        // his round: the bar, the edge of the floor, the bar again (the shared clock, so everyone sees him in the same place)
        const k = Math.floor(st.T / 11000) % PATROL.length, q = PATROL[k], left = go(r, q[0], q[1], 1.15, dt);
        r.pose = left < 0.1 ? (q[1] < -2 ? 'lean' : 'stand') : 'stand'; if (left < 0.1 && q[1] < -2) face(r, Math.PI, dt);
        // a grudge: he finds you with a drink in your hand and "does not see you"
        if (X.grudge && !X.grudgeDone && st.T > (r.sulk || 0) && (S.cup || S.gift) && !S.talk && !S.partner && dTo(r) < 9 && p.place === ID) {
          if (dTo(r) > 0.7) go(r, p.pos.x, p.pos.z, 2.3, dt); else { X.grudgeDone = true; S.spill(st, null); p.stumble && p.stumble({ x: p.pos.x - r.x, z: p.pos.z - r.z }, 0.3); X.provoke('grudge', 'him'); }
        }
        // running into him
        else if (dTo(r) < 0.55 && p.speed > 3.0 && !game.activity) { if (r.cup) audio.splash({ x: r.x, y: 1.1, z: r.z, place: ID }); X.provoke(r.cup ? 'spill' : 'barge', 'me'); }
      }
    }
    // bouncers (only ever here on business)
    for (let i = X.bouncers.length - 1; i >= 0; i--) {
      const b = X.bouncers[i]; let tw = null;
      if (b.job === 'come') { const Ft = X.fight; if (Ft) { const lead = Math.max(0.5, Ft.s.bouncersAt - Ft.s.t), tx = r.x + (i ? 1.2 : -1.2), d = Math.hypot(tx - b.x, r.z - b.z); go(b, tx, r.z, clamp(d / lead, 1.0, 3.2), dt); } }
      else if (b.job === 'takeHim') { const d = Math.hypot(r.x - b.x, r.z - b.z); if (d > 0.75) go(b, r.x - 0.55, r.z, 2.4, dt); else { b.x += (r.x - 0.55 - b.x) * Math.min(1, dt * 6); b.z += (r.z - b.z) * Math.min(1, dt * 6); b.h = r.h; b.speed = r.speed; } tw = (c) => escortTweak(c, 1); if (r.gone) b.job = 'leave'; }
      else if (b.job === 'takeMe') { const d = dTo(b), tx = p.pos.x - Math.cos(p.heading) * 0.55, tz = p.pos.z + Math.sin(p.heading) * 0.55; if (d > 1.0) go(b, tx, tz, 3.0, dt); else { b.x += (tx - b.x) * Math.min(1, dt * 8); b.z += (tz - b.z) * Math.min(1, dt * 8); b.h = p.heading; b.speed = p.speed; b.y = p.pos.y; } tw = (c) => escortTweak(c, -1); }
      else if (b.job === 'warn') { const d = dTo(b); if (d > 1.6) go(b, p.pos.x, p.pos.z, 2.0, dt); else { b.speed = 0; S.faceTo(b, p.pos.x, p.pos.z, dt, 6); b.wait += dt; if (!b.told) { b.told = true; say(b, So.PROVOKE.bouncer.warn, 4); } tw = palmsTweak; if (b.wait > 4) { b.job = 'leave'; b.told = false; } } }
      else if (b.job === 'leave') { if ((b.wait = (b.wait || 0) - dt) > 0) { b.speed = 0; } else if (go(b, 14.8, -3.3, 1.5, dt) < 0.2) { freeChar(b.ch); X.bouncers.splice(i, 1); continue; } }
      const g = b.ch.group; g.visible = true; g.position.set(b.x, b.y || 0, b.z); g.rotation.y = b.h; if (b.ch.pose !== 'stand') b.ch.setPose('stand'); b.ch.update(dt, b.speed || 0); if (tw) tw(b.ch);
    }
    // draw him
    const g = r.ch.group, vis = r.on && !r.gone && (Math.hypot(r.x - cam.x, r.z - cam.z) < 16 || !!X.fight);
    g.visible = vis;
    if (vis) {
      g.position.set(r.x, r.y || 0, r.z); g.rotation.y = r.h;
      const want = r.speed > 0.1 && r.pose !== 'sitground' ? 'stand' : r.pose; if (r.ch.pose !== want) r.ch.setPose(want);
      if (want === 'dance' && st.beat !== undefined) r.ch.t = (st.beat + 1) / 2.07 - dt;
      r.ch.update(dt, r.speed || 0); if (r.tweak) r.tweak(r.ch);
      if (r.cup && want !== 'lean' && !r.tweak) { const bn = r.ch.bones; bn.armR.rotation.x = -0.25; bn.foreR.rotation.x = -1.3; }
      if (!X.fight && !game.activity) { const dx = p.pos.x - r.x, dz = p.pos.z - r.z, d = Math.hypot(dx, dz); if (d < 0.42 && d > 1e-3) { p.pos.x += (dx / d) * (0.42 - d) * 0.6; p.pos.z += (dz / d) * (0.42 - d) * 0.6; } }
      S.avoid.push(r.x, r.z);
    }
    void onFloor; void LAY;
  };
  X.leave = () => { if (X.fight) { const p = pl(); if (X.fight.frozen) p.frozen = Math.max(0, p.frozen - 1); if (p.pose === 'sitground') p.pose = 'stand'; X.fight = null; S.scrap = false; } X.prov = null; X.cut = null; };
  X.state = () => ({ rival: X.rival ? { name: X.rival.name, on: X.rival.on, gone: X.rival.gone, x: +X.rival.x.toFixed(1), z: +X.rival.z.toFixed(1), pose: X.rival.pose } : null, cut: X.cut ? { beats: X.cut.beats, mine: X.cut.mine, his: X.cut.his, facing: X.cut.facing } : null, prov: X.prov ? X.prov.reason : null,
    fight: X.fight ? { t: +X.fight.s.t.toFixed(1), me: { ...X.fight.s.me }, opp: { ...X.fight.s.opp }, bouncersAt: +X.fight.s.bouncersAt.toFixed(1) } : null, bouncers: X.bouncers.map((b) => b.job), out: X.out ? X.out.why : null, last: X.last, barred: flags().ptBarred === (S.st ? S.st.night : -1) });
  X.clear = () => { if (X.rival) freeChar(X.rival.ch); for (const b of X.bouncers) freeChar(b.ch); X.rival = null; X.bouncers.length = 0; X.night = null; };
  return X;
}
