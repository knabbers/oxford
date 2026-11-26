// Purple Turtle — a night out, played with the ordinary controls (nothing here stops you walking about):
//   tonight's invented club-goers (three women, three men, each with a friend: _pt_social_logic.js personasFor) keep a
//   timetable on the shared clock — the floor, a high table with their friend, the bar (where they order what they like),
//   the quiet nook — so every player sees them in the same places;
//   catching an eye across the room (look at them when they look over, hold it, look away when they do);
//   walking up and saying hello (E) — not while they are deep in conversation — and shouting back over the music (1 2 3);
//   catching the bartender's eye, carrying drinks through the crowd, handing one over;
//   dancing: on the floor, tap (Space or the mouse button) on the beat of the DJ's track, with A / D / W / S for the step;
//   with a partner, make their move with them;
//   and, if it has gone well, they suggest walking home (_pt_walkhome.js).
// The rival, the scrap and the bouncers are in _pt_scrap.js. Rules and every line of dialogue: _pt_social_logic.js.
import * as THREE from 'three';
import * as Lg from './_pt_logic.js';
import * as So from './_pt_social_logic.js';
import { LAY, groundAt } from './_pt_interior.js';
import { randomLook, resolveLook } from '../core/characters.js';
import { makeChar, freeChar, moveTweak, pourTweak } from './_pt_chars.js';
import { ptGlow } from './_pt_tex.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const ID = 'purple_turtle';
const F = LAY.floor;
export const onFloor = (x, z, m = 0.25) => x > F.x0 - m && x < F.x1 + m && z > F.z0 - m && z < F.z1 + m;
// where they stand: [x, z, heading] by spot and index; the friend's place is beside (dx, dz)
const SPOT = {
  f: { floor: [[-3.6, 2.5], [-1.2, 4.7], [0.9, 2.7]], huddle: [[-5.95, -3.2], [-3.95, -1.0], [5.55, 2.0]], bar: [[-2.9, -2.95], [-0.5, -2.95], [3.3, -2.95]], sofa: [[-3.6, 9.3], [-2.4, 10.2], [-1.7, 8.5]] },
  m: { floor: [[-4.8, 4.6], [-2.5, 5.3], [1.5, 4.9]], huddle: [[-5.95, -1.2], [6.95, 5.2], [4.2, 1.3]], bar: [[-1.9, -2.95], [1.5, -2.95], [4.0, -2.95]], sofa: [[0.6, 9.6], [1.8, 8.4], [3.0, 10.3]] },
};
const TABLE = { f: [[-6.6, -3.2], [-4.6, -1.0], [6.2, 2.0]], m: [[-6.6, -1.2], [7.6, 5.2], [4.6, 0.85]] };
const CHAT = {
  funny: ['And then he fell IN the Cherwell!', "Stop, I can't breathe!", 'No WAY. Ha!', 'I am never punting again.'],
  sincere: ['I just really love nights like this.', "You're such a good friend, you know.", 'I do miss home sometimes.', "I'm so glad we came out."],
  nerdy: ['…so the proof falls apart on line three.', "It's not even a real Latin word!", 'I read the whole reading list. Twice.', 'Technically it is a tortoise.'],
  friend: ['Ha!', 'No!', 'Go ON.', 'Mm.', 'Shut UP.', 'Classic.'],
};
const WARM = { cold: ['Mm.', 'Right.'], polite: ['Ha, OK.', 'You again!'], warm: ['Not bad!', 'You CAN dance!', 'I love this one!'], keen: ['Don\'t stop!', 'Where did you learn that?', 'Best night in ages.'] };

/** the look of one of tonight's invented people (the same on every client) */
export function personaLook(P, state = 0.3, seed = P.seed) {
  const Lk = randomLook(seed, { outfit: 'clubbing', range: P.sex === 'f' ? 'womens' : 'mens', theme: 'none', state: Math.min(0.5, state) });
  Lk.prop = null; if (Lk.club) Lk.club.carry = 'none';
  return Lk;
}
/** the strip of things you can say: number keys, no pause, nothing modal */
export function createStrip(game) {
  let el = null, cur = null;
  const mk = () => { if (el || typeof document === 'undefined') return; el = document.createElement('div'); el.id = 'pt-strip';
    el.style.cssText = 'position:fixed;left:50%;bottom:92px;transform:translateX(-50%);max-width:92vw;pointer-events:none;font:15px/1.35 Georgia,serif;color:#f4ecff;text-shadow:0 1px 3px #000,0 0 8px #000;text-align:left;display:none;z-index:6;background:rgba(10,4,16,0.42);padding:6px 12px;border-radius:6px';
    document.body.appendChild(el); };
  const St = {
    get open() { return !!cur; },
    get tag() { return cur ? cur.tag : null; },
    /** opts: [text…]; cb(index | null) (null: time ran out / you walked off). tag names it for tests. */
    show(tag, title, opts, secs, cb) {
      mk(); if (cur && cur.cb) { const c = cur; cur = null; try { c.cb(null); } catch (e) { console.error(e); } }
      cur = { tag, title, opts, t: secs, cb };
      if (el) { el.innerHTML = (title ? `<div style="opacity:.75;font-style:italic">${title}</div>` : '') + opts.map((o, i) => `<div><b style="color:#ffd84a">${i + 1}</b>&nbsp; ${o}</div>`).join(''); el.style.display = 'block'; }
    },
    pick(i) { if (!cur) return false; const c = cur; cur = null; if (el) el.style.display = 'none'; try { c.cb(i === null || i >= c.opts.length ? null : i); } catch (e) { console.error(e); } return true; },
    close() { if (cur) St.pick(null); },
    update(dt) {
      if (!cur) return;
      for (let i = 0; i < cur.opts.length && i < 9; i++) if (game.input.hit('Digit' + (i + 1)) || game.input.hit('Numpad' + (i + 1))) { St.pick(i); return; }
      if ((cur.t -= dt) <= 0) St.pick(null);
    },
    options() { return cur ? cur.opts.slice() : null; },
  };
  return St;
}

export function createSocial(game, pt, scene, col, audio, strip) {
  const S = { actors: new Map(), night: null, sex: null, t: 0, hint: {}, gift: null, cup: null, dance: { active: false, streak: 0, groove: 0, x: 0, z: 0, taps: [], acc: null, lastTap: -99, lastBeat: null, best: 0 },
    bar: { a: 0, serving: null, t: 0 }, talk: null, partner: null, invite: null, leaving: null, avoid: [], scrap: null, engaged: null, auto: {} };
  const P3 = new THREE.Vector3(), tmpV = new THREE.Vector3();
  const flags = () => (game.state.flags = game.state.flags || {});
  const hintOnce = (k, text, secs = 6) => { if (S.hint[k] || flags()['ptH' + k]) return; S.hint[k] = 1; flags()['ptH' + k] = 1; try { game.ui.toast(text, secs); } catch { /* headless */ } };
  const playerSex = () => { try { return resolveLook(game.player.look).figure === 'f' ? 'f' : 'm'; } catch { return 'm'; } };
  const blocked = (x1, z1, x2, z2) => { try { return col.raycast(x1, z1, x2, z2) !== null; } catch { return false; } };

  // ------------------------------------------------------------------ getting about the cellars
  const roomOf = (x, z) => (x > LAY.X1 ? (z < -2 ? 'S' : 'C') : z < 0.3 ? 1 : z < 6.9 ? 2 : 3);
  function pathTo(ax, az, bx, bz) {
    const out = []; let a = roomOf(ax, az); const b = roomOf(bx, bz);
    const via = (opens, za, zb, x0) => { const c = opens.map(([p, q]) => (p + q) / 2).sort((p, q) => Math.abs(p - x0) + Math.abs(p - bx) - Math.abs(q - x0) - Math.abs(q - bx))[0]; out.push([c, za], [c, zb]); return c; };
    let x = ax;
    if (a === 'S') { out.push([8.4, -3.3]); x = 8.4; a = 1; }
    if (a === 'C') { out.push([8.5, 3.7]); x = 8.5; a = 2; }
    const tb = b === 'S' ? 1 : b === 'C' ? 2 : b;
    while (a !== tb) {
      if (a < tb) { x = a === 1 ? via(LAY.open12, -0.5, 1.1, x) : via(LAY.open23, 6.2, 7.7, x); a++; }
      else { x = a === 3 ? via(LAY.open23, 7.7, 6.2, x) : via(LAY.open12, 1.1, -0.5, x); a--; }
    }
    if (b === 'S') out.push([8.4, -3.3]); if (b === 'C') out.push([8.5, 3.7]);
    out.push([bx, bz]);
    return out;
  }
  /** walk m towards (tx, tz) through the openings; returns metres left */
  function go(m, tx, tz, v, dt) {
    if (!m.path || m.ptx !== tx || m.ptz !== tz) { m.path = pathTo(m.x, m.z, tx, tz); m.pi = 0; m.ptx = tx; m.ptz = tz; }
    // (a waypoint already reached is passed in the same call: a target that moves every frame rebuilds the path every frame)
    // …and one already passed (nearer the next waypoint than this one is) is not gone back to
    while (m.pi < m.path.length - 1) { const a = m.path[m.pi], b = m.path[m.pi + 1]; if (Math.hypot(a[0] - m.x, a[1] - m.z) < 0.08 || Math.hypot(b[0] - m.x, b[1] - m.z) < Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.01) m.pi++; else break; }
    let left = 0; const w = m.path[Math.min(m.pi, m.path.length - 1)];
    const dx = w[0] - m.x, dz = w[1] - m.z, d = Math.hypot(dx, dz);
    for (let i = m.pi + 1; i < m.path.length; i++) left += Math.hypot(m.path[i][0] - m.path[i - 1][0], m.path[i][1] - m.path[i - 1][1]);
    if (d < 0.08) { m.speed = 0; return 0; }
    const s = Math.min(d, v * dt); m.x += (dx / d) * s; m.z += (dz / d) * s; m.speed = dt > 0 ? s / dt : 0;
    m.h += wrapA(Math.atan2(dx, dz) - m.h) * Math.min(1, dt * 8);
    m.y = groundAt(m.x, m.z);
    return left + d - s;
  }
  const face = (m, h, dt, k = 5) => { m.h += wrapA(h - m.h) * Math.min(1, dt * k); };
  const faceTo = (m, x, z, dt, k = 5) => face(m, Math.atan2(x - m.x, z - m.z), dt, k);
  S.go = go; S.face = face; S.faceTo = faceTo;

  // ------------------------------------------------------------------ tonight's people
  function spawn(st) {
    for (const A of S.actors.values()) { freeChar(A.ch); freeChar(A.fr.ch); if (A.cup) A.cup.removeFromParent(); }
    S.actors.clear(); S.remote.clear(); S.goneKeys.clear(); S.night = st.night; S.sex = playerSex(); S.partner = null; S.talk = null; S.invite = null; S.leaving = null;
    for (const sex of ['f', 'm']) for (const P of So.personasFor(st.night, sex)) {
      const A = { P, key: P.key, prospect: sex !== S.sex, C: So.newCourt(), ch: makeChar(personaLook(P, st.state), scene), x: 8.4, z: -3.3, y: 0, h: -Math.PI / 2, speed: 0, state: 'out', said: {},
        gl: { phase: 'idle', t: 0, k: 0, next: 4 + Lg.hash('gl0', P.seed) * 6, watch: 0, glow: 0, away: 0 }, sayT: 2 + P.i * 1.3, crowdT: 0, cup: null, vis: false, away: null, dragged: false,
        fr: { ch: makeChar(personaLook(P, st.state, P.friendSeed), scene), x: 8.4, z: -3.3, y: 0, h: -Math.PI / 2, speed: 0, vis: false } };
      A.ch.lookAtPlayer = false; A.ch.group.visible = false; A.fr.ch.group.visible = false;
      S.actors.set(P.key, A);
    }
    // someone you walked home before is pleased to see you (the same person only while the night's seed gives them)
    S.sweet = game.state.ptSweet || null;
  }
  const spotPos = (A, spot) => SPOT[A.P.sex][spot][A.P.i];
  function friendPos(A, spot) {
    const [x, z] = spotPos(A, spot);
    if (spot === 'huddle') { const T = TABLE[A.P.sex][A.P.i]; return [T[0] - (x - T[0]), z + (T[1] - z) * 2]; }
    if (spot === 'floor') return [x + 0.95, z + 0.5];
    if (spot === 'bar') return [x + 0.85, z];
    return [x + 0.9, z + 0.4];
  }
  const AWAY = [[10.3, 3.45], [11.0, 3.95], [5.2, -2.95], [7.3, 8.2], [10.7, 3.5], [6.1, -1.3]];
  function setCup(A, kind) {
    if (A.cup) { A.cup.removeFromParent(); A.cup = null; }
    if (!kind) return;
    A.cup = pt.makeCup(kind); A.ch.anchors.handR.add(A.cup); A.cupKind = kind;
  }
  const nearP = (A) => Math.hypot(A.x - game.player.pos.x, A.z - game.player.pos.z);
  const herTipsy = (A, st) => So.tipsy(A.P, st.nh);
  const env = (A, st) => ({ drunk: game.player.drunk || 0, herTipsy: herTipsy(A, st), closing: !!st.lightsUp });
  const say = (m, text, secs = 2.6) => { try { m.ch.say(text, secs); } catch { /* */ } };
  const meSay = (text, secs = 2.2) => { try { game.player.character.say(text, secs); } catch { /* */ } };
  const fill = (t) => t.replace('{college}', pt.college());
  S.say = say; S.meSay = meSay; S.nearP = nearP;

  // ------------------------------------------------------------------ eyes across the room
  function looking(A) {
    const p = game.player, dx = A.x - p.pos.x, dz = A.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 2.4 || d > 14) return false;
    if (Math.abs(wrapA(Math.atan2(dx, dz) - game.cameraYaw)) > 0.17) return false;
    return !blocked(p.pos.x, p.pos.z, A.x, A.z);
  }
  function glance(A, dt, st) {
    const g = A.gl, P = A.P, C = A.C, p = game.player;
    const look = S.auto.look === A.key ? true : S.auto.look === false ? false : looking(A);
    const toMe = wrapA(Math.atan2(p.pos.x - A.x, p.pos.z - A.z) - A.h);
    g.glow = Math.max(0, g.glow - dt); g.away = Math.max(0, g.away - dt);
    const done = (res) => {
      const d = So.onGlance(P, C, res); g.phase = 'idle'; g.next = 7 + Lg.hash('gln', P.seed, g.k) * 6; g.k++; g.watch = 0; S.lastGlance = { key: A.key, res, d };
      if (res === 'stare') { g.away = 7; if (nearP(A) < 9) say(A.fr, Lg.hash('st', g.k) < 0.5 ? 'That one is STARING.' : 'Ew. Do not look.', 2.2); }
      else if (d > 0) { g.glow = 2.6; audio.spark(); }
    };
    if (g.phase === 'idle') {
      if (P.mood === 'no' || C.over || A.state !== 'sched' || st.lightsUp) { g.watch = look ? g.watch + dt : Math.max(0, g.watch - dt * 2); if (g.watch > 7 && P.mood !== 'no') done('stare'); return; }
      g.watch = look ? g.watch + dt : Math.max(0, g.watch - dt * 2);
      if (g.watch > 6.5) { done('stare'); return; }                       // watching someone who has not looked back is just staring
      g.next -= dt * (P.mood === 'lukewarm' ? 0.6 : 1);
      if (g.next <= 0) { g.phase = 'scan'; g.t = 0; }
    } else if (g.phase === 'scan') {                                       // they look over for a couple of seconds
      g.t += dt;
      const d = nearP(A), sees = d < 14 && d > 2.4 && Math.abs(toMe) < 2.0 && !blocked(p.pos.x, p.pos.z, A.x, A.z);
      if (sees) A.headTo = clamp(toMe, -1.3, 1.3);
      if (sees && look) { g.phase = 'contact'; g.t = 0; g.hers = So.glanceHold(P, g.k); hintOnce('Eye', 'Your eyes meet. Hold it… and look away when they do.'); }
      else if (g.t > 2.2) { g.phase = 'idle'; g.next = 5 + Lg.hash('gln', P.seed, g.k++) * 5; }
    } else if (g.phase === 'contact') {
      g.t += dt;
      if (g.t < g.hers) A.headTo = clamp(toMe, -1.3, 1.3); else A.headDown = P.eye[0] < 0.95 ? 0.3 : 0;      // (the shy ones look at the floor)
      if (!look) done(So.judgeGlance(g.t, g.hers, p.drunk || 0));
      else if (g.t > g.hers + 0.75 + 0.35 * So.confidence(p.drunk || 0)) done('stare');
    }
    if (g.glow > 0 && g.glow < 1.7 && g.glow > 1.0) A.headTo = clamp(toMe, -1.3, 1.3);     // a second, quicker look
  }

  // ------------------------------------------------------------------ saying hello, and what follows
  function endTalk(A, st, quiet) {
    if (S.talk && S.talk.A === A) S.talk = null;
    if (strip.tag === 'talk') strip.close();
    if (A.state === 'talk') { A.state = A.waitFor ? 'wait' : 'sched'; A.hold = st.T + (A.waitFor ? 75000 : 6000); }
    void quiet;
  }
  function ask(A, st) {
    const T = S.talk; if (!T || T.A !== A) return;
    const P = A.P, C = A.C;
    if (So.readyToLeave(P, C, env(A, st)) && !A.invited) { endTalk(A, st); invite(A, st); return; }
    const q = So.nextPrompt(P, C); T.q = q; T.phase = 'ask';
    say(A, fill(q.she), 3.2);
    A.mood = q.mood;
    // (the order of the answers is shuffled so the place in the list is never the tell)
    const order = [0, 1, 2].sort((a, b) => Lg.hash('ord', P.seed, C.talks, a) - Lg.hash('ord', P.seed, C.talks, b));
    T.order = order; T.wait = 0.9;
  }
  function answer(A, st, i) {
    const T = S.talk; if (!T || T.A !== A) return;
    const q = T.q, o = i === null ? null : q.opts[T.order[i]], P = A.P, C = A.C;
    const r = So.onTalk(P, C, q, o ? o[0] : null, env(A, st));
    if (o) meSay(r.fluffed ? 'I — er — yes. What?' : fill(o[1]), 2.2);
    S.lastTalk = { key: A.key, kind: o ? o[0] : null, ...r, spark: C.spark };
    T.phase = 'reply'; T.wait = o ? 1.5 : 0.4; T.r = r;
  }
  function approach(A, st) {
    const p = game.player, sp = So.spotAt(A.P, st.T), frNear = Math.hypot(A.fr.x - A.x, A.fr.z - A.z) < 1.9;
    const friendTalking = A.state === 'sched' && sp.friend && (sp.spot === 'huddle' || sp.spot === 'sofa') && frNear && A.arrived;
    const r = So.onApproach(A.P, A.C, { ...env(A, st), friendTalking, running: p.speed > 3.6 });
    S.lastApproach = { key: A.key, ...r };
    say(r.who === 'friend' ? A.fr : A, r.line, 3);
    if (r.bouncer && pt.scrap) pt.scrap.warn(A);
    if (A.C.met && A.P.mood !== 'no') A.ch.setLabel(A.P.name);
    if (!r.ok) { A.snub = 4; return false; }
    A.state = 'talk'; S.talk = { A, phase: 'hello', wait: 2.0, q: null, order: null, r: null }; S.engaged = A;
    return true;
  }
  function talkTick(A, dt, st) {
    const T = S.talk, d = nearP(A);
    if (d > 3.4) { if (strip.tag === 'talk') strip.pick(null); else { So.onTalk(A.P, A.C, T.q || So.PROMPTS[0], null, env(A, st)); } say(A, '…Anyway.', 2); endTalk(A, st); return; }
    T.wait -= dt;
    if (T.wait > 0) return;
    if (T.phase === 'hello') ask(A, st);
    else if (T.phase === 'ask') { T.phase = 'pick'; strip.show('talk', null, T.order.map((k) => fill(T.q.opts[k][1])), 8, (i) => answer(A, st, i)); }
    else if (T.phase === 'reply') {
      const r = T.r; say(A, r.reply, 2.6); T.phase = 'after'; T.wait = 2.3;
      if (r.tell) { A.waitFor = r.tell; hintOnce('Bar', 'Catch the bartender\'s eye at the bar: look at them when they look your way.'); }
    } else if (T.phase === 'after') {
      const r = T.r;
      if (r.dance) { endTalk(A, st); startDance(A, st); }
      else if (r.end) endTalk(A, st);
      else ask(A, st);
    }
  }
  function invite(A, st) {
    A.invited = true; A.state = 'talk'; S.invite = { A, t: 0 };
    const D = pt.walk ? pt.walk.destFor(A.P) : null;
    say(A, st.lightsUp ? `That's us chucked out, then. Walk me home?${D ? ` I'm ${D.phrase}.` : ''}` : `I should head back, really. Walk me home?${D ? ` I'm ${D.phrase}.` : ''}`, 5);
    strip.show('invite', null, ["I'd love to.", 'Not tonight — but this was fun.'], 12, (i) => {
      S.invite = null;
      if (i === 0) { meSay("I'd love to."); A.state = 'lead'; A.leadT = 0; A.leadPhase = 'coat'; S.leaving = A; say(A, 'Let me grab my bag.', 2.4); }
      else if (i === 1) { meSay('Not tonight — but this was fun.'); say(A, 'It was. Find me next time, yeah?', 3); A.state = 'sched'; A.C.over = true; A.C.why = 'declined'; }
      else { say(A, "Have a think. I'm not going just yet.", 3); A.state = 'sched'; A.hold = st.T + 9000; A.reask = st.T + 20000; }      // (no answer / you wandered off: they ask once more, later)
    });
  }
  S.invite_ = invite;

  // ------------------------------------------------------------------ dancing
  function startDance(A, st) { A.state = 'dance'; S.partner = A; S.engaged = A; A.dn = { beats: 0, miss: 0, run: 0, gap: A.P.near + 0.5, lastB: null, off: 0, said: 0, wx: 0, wz: 0, rivalBeats: 0 }; if (!onFloor(A.x, A.z)) say(A, 'Come on!', 2); hintOnce('Dance', 'Dance: tap Space (or click) on the beat. A / D / W / S for the step — move with them.', 7); }
  function stopDance(A, st, line) {
    if (S.partner === A) S.partner = null;
    if (A.state === 'dance') A.state = 'sched';
    if (line) say(A, line, 3);
    if (So.readyToLeave(A.P, A.C, env(A, st)) && !A.invited) invite(A, st);
  }
  S.stopDance = stopDance;
  function tapNow() {
    const D = S.dance, bf = audio.beatFloat, b = Math.round(bf), off = (bf - b) * audio.spb, inp = game.input;
    const dir = inp.down('KeyA') || inp.down('ArrowLeft') ? 'left' : inp.down('KeyD') || inp.down('ArrowRight') ? 'right' : inp.down('KeyW') || inp.down('ArrowUp') ? 'up' : inp.down('KeyS') || inp.down('ArrowDown') ? 'down' : 'bounce';
    return tap(dir, off, b);
  }
  function tap(dir, off, b) {
    const D = S.dance, p = game.player, q = So.judgeTap(off, p.drunk || 0, Math.sin(b * 12.9898) * 43758.5453 % 1);
    if (!D.active) { D.active = true; D.streak = 0; D.groove = 0.4; D.x = p.pos.x; D.z = p.pos.z; D.lastBeat = b - 1; }
    D.taps.push({ b, q, dir, off }); if (D.taps.length > 8) D.taps.shift();
    D.lastTap = audio.beatFloat; D.acc = { dir, w: 1, q };
    D.flash = { q, t: 0.35 };
    audio.tap(q);
    return q;
  }
  S.tap = (dir = 'bounce', off = 0) => tap(dir, off, Math.round(audio.beatFloat));
  /** judge beat b (called half a beat after it): the player's tap, and what it means to whoever is watching */
  function beatDone(b, st) {
    const D = S.dance, p = game.player;
    let t = null; for (const k of D.taps) if (k.b === b && !k.used) { t = k; k.used = true; break; }
    const q = t ? t.q : null;
    if (q === 'perfect' || q === 'good') { D.streak++; D.best = Math.max(D.best, D.streak); D.groove += ((q === 'perfect' ? 1 : 0.75) - D.groove) * 0.3; }
    else { D.streak = 0; D.groove += (0 - D.groove) * 0.3; }
    if (D.streak > 0 && D.streak % 32 === 0) { game.state.legend = (game.state.legend || 0) + 1; audio.cheer(); }
    const A = S.partner;
    if (A && A.state === 'dance' && onFloor(A.x, A.z, 0.6)) {
      const P = A.P, C = A.C, dn = A.dn, mv = So.partnerMove(P, b), match = !!t && t.dir === So.MIRROR[mv], d = nearP(A);
      const g = So.onBeat(P, C, q, match, d, true);
      dn.beats++; dn.last = { b, q, match, g };
      if (q && q !== 'off' && match) { dn.run++; dn.miss = 0; } else { dn.run = 0; dn.miss++; }
      if (dn.run > 0 && dn.run % 4 === 0) dn.gap = Math.max(P.near, dn.gap - 0.12);
      if (dn.miss >= 4) dn.gap = Math.min(P.near + 0.9, dn.gap + 0.1);
      if (d < 0.5 && (dn.crowdCd || 0) <= 0) { dn.crowdCd = 6; say(A, 'Bit of space!', 2); }
      if (dn.said <= 0 && !A.ch.saying) {
        if (dn.run === 8 || dn.run === 20) { const W = WARM[So.bearing(P, C)]; say(A, W[Math.floor(Lg.hash('w', P.seed, dn.beats) * W.length)], 2.2); dn.said = 8; }
        else if (dn.miss === 6) { say(A, 'You OK there?', 2); dn.said = 8; }
      }
      if (pt.scrap) pt.scrap.onDanceBeat(A, st, { q, match });
      // a breather when they have had their fill of it (or you have lost them)
      const phraseEnd = (b + 1) % 16 === 0, cutting = !!(pt.scrap && pt.scrap.cut && pt.scrap.cut.A === A);      // (nobody walks off mid dance-off)
      if (cutting) { /* settled by the dancing */ }
      else if (phraseEnd && dn.beats >= 32 && (C.danceGain >= 27 || dn.beats >= 112)) stopDance(A, st, So.readyToLeave(P, C, env(A, st)) ? null : 'I need a breather. That was fun!');
      else if (dn.miss >= 14) stopDance(A, st, "I'm going to find my friend.");
    } else if (D.active) {
      // on your own: anyone who fancies a look gets one
      for (const B of S.actors.values()) if (B.prospect && B.state === 'sched' && B.arrived && nearP(B) < 6.5 && !blocked(p.pos.x, p.pos.z, B.x, B.z)) So.onBeat(B.P, B.C, q, false, nearP(B), false);
    }
  }
  function danceTick(dt, st) {
    const D = S.dance, p = game.player, inp = game.input, floor = onFloor(p.pos.x, p.pos.z) && !st.lightsUp && !game.activity && !S.scrap;
    if (floor && (inp.hit('Space') || (inp.clicked && inp.locked))) {
      // (on the dance floor Space is a step, not a jump: put the feet back down)
      if (!p.onGround && p.vy > 0) { p.vy = 0; p.onGround = true; p.pos.y = game.groundHeight(p.pos.x, p.pos.z); p._sqv += 2.2; p.syncMesh(); }
      tapNow();
    }
    if (S.auto.dance && floor) {       // (test hook: taps on the beat with the partner's move, hitting `auto.dance` of the beats)
      const bf = audio.beatFloat, b = Math.round(bf);
      if (bf >= b && D.autoB !== b) { D.autoB = b; if (Lg.hash('auto', b) < S.auto.dance) { const A = S.partner; tap(A ? So.MIRROR[So.partnerMove(A.P, b)] : 'bounce', (Lg.hash('ao', b) - 0.5) * 0.06, b); } }
    }
    const bf = audio.beatFloat, withP = floor && !!S.partner && S.partner.state === 'dance' && onFloor(S.partner.x, S.partner.z, 0.6);
    if (D.active && (!floor || bf - D.lastTap > 6)) { D.active = false; D.streak = 0; if (p.pose === 'dance') p.pose = 'stand'; }
    if (D.active || withP) {
      const b = Math.floor(bf - 0.5);
      if (D.lastBeat === null || b - D.lastBeat > 4 || b < D.lastBeat) D.lastBeat = b - 1;
      while (D.lastBeat < b) beatDone(++D.lastBeat, st);
    } else D.lastBeat = null;
    if (D.active) {
      {
        p.pose = D.groove >= 0.3 ? 'dance' : 'stand';
        p.character.t = bf / 2.07;                                         // the loop keeps the DJ's time
        // shuffling, not striding; and you face the way you are looking
        const sp = Math.hypot(p.vx, p.vz), cap = 1.25; if (sp > cap) { p.vx *= cap / sp; p.vz *= cap / sp; }
        p.heading += wrapA(game.cameraYaw - p.heading) * Math.min(1, dt * 10);
        if (D.acc) { D.acc.w -= dt * 3.2; if (D.acc.w <= 0) D.acc = null; else moveTweak(p.character, D.acc.dir, D.acc.w * (D.acc.q === 'off' ? 0.5 : 1), D.acc.q === 'off' ? Math.sin(game.elapsed * 31) * 0.12 : 0); }
        D.x = p.pos.x; D.z = p.pos.z;
      }
    }
    // the light at your feet: it breathes with the beat, and shows how the last step landed
    if (S.ring) {
      const on = floor && (D.active || !!S.partner);
      S.ring.visible = on;
      if (on) {
        const ph = bf - Math.floor(bf), k = Math.exp(-ph * 5);
        S.ring.position.set(p.pos.x, 0.03, p.pos.z); S.ring.scale.setScalar(0.75 + 0.5 * k);
        if (D.flash) { D.flash.t -= dt; if (D.flash.t <= 0) D.flash = null; }
        const q = D.flash ? D.flash.q : null;
        S.ring.material.color.setHex(q === 'perfect' ? 0xffe9a0 : q === 'good' ? 0x8ad0ff : q === 'off' ? 0x902020 : 0x8050c0);
        S.ring.material.opacity = (q ? 0.55 : 0.12 + 0.2 * k);
      }
    }
  }
  S.ring = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ptGlow(), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
  S.ring.visible = false; S.ring.frustumCulled = false; scene.add(S.ring);

  // ------------------------------------------------------------------ the bar, and drinks in your hands
  const barZ = LAY.bar.front;
  const atBar = (x, z) => z < barZ + 1.0 && z > barZ + 0.1 && x > LAY.bar.x0 - 0.2 && x < LAY.bar.x1 + 0.2;
  const MENU = ['pint', 'cider', 'snakebite', 'vodka', 'gin', 'rum', 'alcopop', 'jager', 'water'];
  const cap1 = (s) => s.replace(/^an? /, '').replace(/^./, (c) => c.toUpperCase());
  function serve(staff, st) {
    S.bar.serving = { staff, step: 0 };
    say(staff, 'What can I get you?', 2.5);
    const opts = MENU.map((k) => `${cap1(Lg.DRINKS[k].name)}${Lg.DRINKS[k].price ? ` — £${Lg.DRINKS[k].price.toFixed(2)}` : ' — free'}`);
    const order = (round) => strip.show('bar', round ? 'And one to take over to someone?' : `£${game.state.money.toFixed(2)} in your pocket`, round ? [...opts, "No, that's all"] : opts, round ? 6 : 12, (i) => {
      if (i === null || i >= MENU.length) { S.bar.serving = null; S.bar.a = 0; S.bar.cool = 3; return; }
      const k = MENU[i], d = Lg.DRINKS[k];
      if (d.price && !game.pay(-d.price)) { say(staff, `That's £${d.price.toFixed(2)}. You haven't got it, have you.`, 3); S.bar.serving = null; S.bar.a = 0; S.bar.cool = 4; return; }
      audio.coin(); S.lastOrder = { kind: k, round };
      say(staff, `${cap1(d.name)}. ${d.price ? `£${d.price.toFixed(2)}, ta.` : 'There you go.'}`, 2.2);
      if (!round) { S.takeCup(k); order(1); } else { S.takeGift(k); S.bar.serving = null; S.bar.a = 0; S.bar.cool = 3; }
    });
    order(0);
  }
  S.takeCup = (kind) => {
    const p = game.player, d = Lg.DRINKS[kind]; if (S.cup) S.cup.mesh.removeFromParent();
    S.cup = { kind, mesh: pt.makeCup(kind), left: d.drunk, t: d.kind === 'shot' ? 2.5 : 24, T: d.kind === 'shot' ? 2.5 : 24 };
    p.character.anchors.handR.add(S.cup.mesh);
  };
  S.takeGift = (kind) => { const p = game.player; if (S.gift) S.gift.mesh.removeFromParent(); S.gift = { kind, mesh: pt.makeCup(kind) }; p.character.anchors.handL.add(S.gift.mesh); };
  function spill(st, who) {
    const g = S.gift || S.cup; if (!g) return;
    g.mesh.removeFromParent(); if (g === S.gift) S.gift = null; else S.cup = null;
    audio.splash(); S.lastSpill = { kind: g.kind, on: who ? who.name || who.key || 'someone' : null };
    try { game.ui.toast(`${cap1(Lg.DRINKS[g.kind].name)}: all over the floor.`, 3); } catch { /* */ }
    if (who && who.rival && pt.scrap) pt.scrap.provoke('spill');
    else if (who && who.A && who.A.prospect) { So.onCrowd(who.A.P, who.A.C); say(who.A, 'Oh! My SHOES!', 2.2); }
    else if (who && who.m) say(who.m, 'Oi! Watch it!', 2);
  }
  S.spill = spill;
  function barTick(dt, st) {
    const p = game.player, B = S.bar, here = atBar(p.pos.x, p.pos.z) && !st.lightsUp && st.open && !game.activity;
    B.cool = Math.max(0, (B.cool || 0) - dt);
    const staff = pt.crowd ? pt.crowd.bartenders() : [];
    // the bartenders look along the bar, pour, look again
    const lk = So.barLook(st.T, st.night);
    for (let i = 0; i < staff.length; i++) {
      const m = staff[i], mine = B.serving && B.serving.staff === m;
      const l = i === 0 ? lk : So.barLook(st.T + 700, st.night + 7);
      m.barLook = l;
      if (mine) { m.hx = clamp(p.pos.x, LAY.bar.x0 + 0.4, LAY.bar.x1 - 0.4); m.xtweak = null; if (Math.abs(m.x - m.hx) < 0.3) m.ch.headTurn(0); }
      else { m.hx = m.spec.x; m.xtweak = l < 0 ? pourTweak : null; m.ch.headTurn(l < 0 ? 0 : clamp(Math.atan2((-2.2 + l * 2.7) - m.x, 1.4), -1.2, 1.2)); }
    }
    if (B.serving) { if (!here && (strip.tag === 'bar')) { strip.close(); } if (!here) { B.serving = null; B.a = 0; } return; }
    if (here && !barSeen) { barSeen = true; hintOnce('Bar', "Catch the bartender's eye: look at them when they look your way."); }
    if (!here || !staff.length || B.cool > 0 || strip.open) { B.a = So.barAttention(B.a, dt, { atBar: false }); return; }
    // nearest bartender: are you looking at them, are they looking at your stretch of the bar
    let m = staff[0]; for (const q of staff) if (Math.abs(q.x - p.pos.x) < Math.abs(m.x - p.pos.x)) m = q;
    const facing = Math.abs(wrapA(Math.atan2(m.x - p.pos.x, m.z - p.pos.z) - game.cameraYaw)) < 0.5;
    const third = clamp(Math.floor((p.pos.x - LAY.bar.x0) / ((LAY.bar.x1 - LAY.bar.x0) / 3)), 0, 2);
    B.a = So.barAttention(B.a, dt, { atBar: true, facing, looked: m.barLook === third });
    B.need = So.barNeed(st.density);
    if (B.a >= B.need || S.auto.bar) serve(m, st);
  }
  function drinkTick(dt, st) {
    const p = game.player;
    // your own: sipped as you go (it only counts once it is down you)
    if (S.cup) {
      const c = S.cup, d = Math.min(c.t, dt); c.t -= dt;
      p.drunk = clamp((p.drunk || 0) + c.left * (d / c.T), 0, 1);
      if (!game.activity && p.character.pose !== 'sit' && !S.scrap) { const ph = (c.T - c.t) % 6, s = ph > 4.6 ? Math.sin(((ph - 4.6) / 1.4) * Math.PI) : 0, bn = p.character.bones; bn.armR.rotation.x = -0.25 - 0.45 * s; bn.foreR.rotation.x = -1.3 - 0.95 * s; }
      if (c.t <= 0) { c.mesh.removeFromParent(); S.cup = null; }
    }
    if (S.gift && !S.scrap) { const bn = game.player.character.bones; bn.armL.rotation.x = -0.25; bn.foreL.rotation.x = -1.3; }
    // through the crowd with a glass in your hand
    if ((S.cup || S.gift) && p.speed > 1.9) {
      let n = 0, who = null, best = 1.1;
      const see = (x, z, o) => { const d = Math.hypot(x - p.pos.x, z - p.pos.z); if (d < 1.1) { n++; if (d < best) { best = d; who = o; } } };
      for (const A of S.actors.values()) { if (A.vis) see(A.x, A.z, { A, name: A.P.name }); if (A.fr.vis) see(A.fr.x, A.fr.z, { m: A.fr }); }
      if (pt.crowd) for (const m of pt.crowd.patrons()) see(m.x, m.z, { m });
      if (pt.scrap && pt.scrap.rival && pt.scrap.rival.on) see(pt.scrap.rival.x, pt.scrap.rival.z, { rival: true, name: pt.scrap.rival.name });
      n += pt.crowd ? pt.crowd.standinsNear(p.pos.x, p.pos.z, 1.3) : 0;
      if (n && Math.random() < So.spillRate(p.speed, n, p.drunk || 0) * dt) spill(st, who);
    }
  }
  function offer(A, st) {
    const g = S.gift; if (!g) return;
    const r = So.onDrink(A.P, A.C, g.kind, env(A, st));
    S.lastOffer = { key: A.key, kind: g.kind, ...r, spark: A.C.spark };
    meSay(`Got you ${Lg.DRINKS[g.kind].name}.`, 2);
    A.say2 = { text: r.line, t: 1.3 };
    if (r.take) { g.mesh.removeFromParent(); S.gift = null; setCup(A, g.kind); A.waitFor = null; if (A.state === 'wait') { A.state = 'sched'; A.hold = st.T + 9000; } }
  }

  // ------------------------------------------------------------------ friends in the club at the same time
  // Whoever is talking to / dancing with / leaving with one of tonight's people sends where that person is (5 Hz);
  // everyone else draws them there instead of on their timetable. Two players after the same person: the one they like
  // better keeps them (someone already leaving always does), and the other is told so.
  const net = game.net; S.remote = new Map(); S.goneKeys = new Set(); S.netT = 0;
  const MINE = { talk: 1, dance: 1, wait: 1, lead: 1 };
  if (net && net.on) {
    net.on('ptn', (d, o) => { if (!d || !o || d.n !== S.night || !Array.isArray(d.a)) return; for (const e of d.a) if (Array.isArray(e) && S.actors.has(e[0]) && Number.isFinite(e[1]) && Number.isFinite(e[2])) S.remote.set(e[0], { e, id: o.id, name: o.name || 'someone', t: performance.now() }); });
    net.on('ptg', (d, o) => { if (!d || d.n !== S.night) return; S.goneKeys.add(d.k); const A = S.actors.get(d.k); if (A && A.prospect && MINE[A.state]) lose(A, o ? o.name : 'someone'); if (A) A.state = 'gone'; });
  }
  function lose(A, name) {
    if (S.talk && S.talk.A === A) { S.talk = null; if (strip.tag === 'talk') strip.close(); }
    if (S.invite && S.invite.A === A) { S.invite = null; strip.close(); } if (S.partner === A) S.partner = null; if (S.leaving === A) S.leaving = null;
    A.state = 'sched'; A.C.over = true; A.C.why = 'with ' + name; S.lastLost = { key: A.key, to: name };
    try { game.ui.toast(`${A.P.name} is with ${name} tonight.`, 5); } catch { /* */ }
  }
  S.gone = (A) => { S.goneKeys.add(A.key); if (net && net.connected) net.send('ptg', { n: S.night, k: A.key }); };
  function netTick(dt) {
    if (!net || !net.connected || (S.netT -= dt) > 0) return; S.netT = 0.2;
    const a = []; for (const A of S.actors.values()) if (A.prospect && MINE[A.state] && !A.puppet) a.push([A.key, +A.x.toFixed(2), +A.z.toFixed(2), +A.h.toFixed(2), A.pose || 'stand', A.state, Math.round(A.C.spark), +(A.y || 0).toFixed(2)]);
    if (a.length || S.netSent) net.send('ptn', { n: S.night, a }); S.netSent = a.length > 0;
  }
  /** drawn where another player's game says they are; true while that is so */
  function puppet(A, dt, st) {
    const R = S.remote.get(A.key); A.puppet = false;
    if (!R || performance.now() - R.t > 1300) return false;
    if (A.prospect && MINE[A.state]) {
      const theirs = R.e[6] + (R.e[5] === 'lead' ? 1000 : 0), mine = A.C.spark + (A.state === 'lead' ? 1000 : 0);
      if (theirs > mine || (theirs === mine && R.id < (net.id || 0))) lose(A, R.name); else return false;       // (they will be told the same, the other way round)
    }
    const k = Math.min(1, dt * 7); A.x += (R.e[1] - A.x) * k; A.z += (R.e[2] - A.z) * k; A.h += wrapA(R.e[3] - A.h) * k; A.y = R.e[7] || 0; A.speed = 0; A.pose = R.e[4]; A.puppet = true; A.arrived = true;
    const f = AWAY[(A.P.i + 2) % AWAY.length]; go(A.fr, f[0], f[1], 1.25, dt); A.fr.pose = 'stand';
    if (R.e[5] === 'dance') { const bf = st.beat || 0, b = Math.round(bf), w = Math.cos(Math.PI * (bf - b)) ** 2, mv = So.partnerMove(A.P, b); A.tweak = (c) => moveTweak(c, mv, w); }
    return true;
  }

  // ------------------------------------------------------------------ one of tonight's people, every frame
  function actorTick(A, dt, st) {
    const P = A.P, C = A.C, fr = A.fr, p = game.player;
    A.headTo = 0; A.headDown = 0; A.tweak = null; fr.tweak = null;
    if (S.goneKeys.has(A.key) && A.state !== 'gone') A.state = 'gone';
    if (A.state !== 'out' && A.state !== 'gone' && puppet(A, dt, st)) return;
    // arriving, leaving
    if (A.state === 'out') { if (st.nh >= P.arrive && st.open && !st.lightsUp) { A.state = 'sched'; A.x = 8.4 + P.i * 0.3; A.z = -3.3; fr.x = 9.2; fr.z = -3.3; if (st.nh > P.arrive + 0.2) { const s = So.spotAt(P, st.T), q = spotPos(A, s.spot), f = friendPos(A, s.spot); A.x = q[0]; A.z = q[1]; fr.x = f[0]; fr.z = f[1]; } } else return; }
    if (A.state === 'gone') return;
    if (A.reask && st.T > A.reask && A.state === 'sched' && !A.away) { A.reask = 0; if (!A.asked2 && nearP(A) < 7) { A.asked2 = true; A.invited = false; if (So.readyToLeave(P, C, env(A, st))) invite(A, st); } else if (!A.asked2) A.reask = st.T + 5000; }
    const tip = herTipsy(A, st);
    if (A.state !== 'taxi' && A.state !== 'lead' && (st.lightsUp || st.nh >= P.taxiAt) && !(S.invite && S.invite.A === A)) {
      // lights up: everybody out (someone you have got on well with asks you to walk them home); earlier, the one who
      // has had too many is taken off to a taxi by their friend — never by you
      if (S.talk && S.talk.A === A) endTalk(A, st); if (S.partner === A) S.partner = null;
      if (st.lightsUp && A.prospect && !A.invited && So.readyToLeave(P, C, env(A, st)) && nearP(A) < 14) invite(A, st);
      else { if (!st.lightsUp && nearP(A) < 10) say(fr, `Come on, ${P.name}. Taxi. Now.`, 3); A.state = 'taxi'; }
    }
    let pose = 'stand', frPose = 'stand', v = 1.25;
    if (A.state === 'taxi') {
      const r = go(A, 14.6, -3.3, 1.0, dt); go(fr, 14.6, -3.3, 1.0, dt); pose = tip > 0.6 ? 'drunk' : 'stand';
      if (r < 0.2) { A.state = 'gone'; A.ch.group.visible = fr.ch.group.visible = false; A.vis = fr.vis = false; return; }
    } else if (A.state === 'sched' || A.state === 'wait') {
      if (A.away && st.T > A.away.until) { A.away = null; if (A.prospect && C.spark >= So.SPARK.chatty && !C.over) A.back = true; }
      const sp = So.spotAt(P, st.T), held = A.hold && st.T < A.hold;
      if (!held) A.spot = A.away ? 'loo' : sp.spot;
      const spot = A.spot || sp.spot, q = spot === 'loo' ? [10.3, 3.45] : spotPos(A, spot);
      let tx = q[0], tz = q[1];
      if (A.back) { const d = nearP(A); tx = p.pos.x; tz = p.pos.z; if (d < 1.7 || p.place !== ID) { A.back = false; if (d < 2.5) { say(A, 'Sorry about that. Where were we?', 2.6); A.hold = st.T + 12000; A.spot = spot; A.backAt = [A.x, A.z]; } } }
      if (A.backAt && held) { tx = A.backAt[0]; tz = A.backAt[1]; } else A.backAt = null;
      const r = go(A, tx, tz, v, dt); A.arrived = r < 0.12;
      const withFr = (sp.friend || !!A.away) && A.state === 'sched' && !A.back && !A.backAt;
      const f = A.away ? [11.0, 3.95] : withFr ? friendPos(A, spot) : AWAY[(P.i + (P.sex === 'f' ? 0 : 3) + sp.slot) % AWAY.length];
      const rf = go(fr, f[0], f[1], v, dt), frHere = rf < 0.15 && withFr;
      if (A.arrived) {
        if (spot === 'floor') { pose = tip > 0.6 ? 'drunk' : 'dance'; face(A, frHere ? Math.atan2(fr.x - A.x, fr.z - A.z) : -Math.PI / 2 + (P.i - 1) * 0.5, dt); }
        else if (spot === 'bar') {
          face(A, Math.PI, dt); pose = 'lean';
          if (A.said.bar !== sp.slot) { A.said.bar = sp.slot; if (tip < 0.5) { A.order = { t: 1.2 }; } }
        } else if (spot === 'huddle') { const T = TABLE[P.sex][P.i]; faceTo(A, frHere ? fr.x : T[0], frHere ? fr.z : T[1], dt); pose = frHere ? 'talk' : tip > 0.6 ? 'drunk' : 'stand'; }
        else if (spot === 'loo') { face(A, Math.PI / 2, dt); pose = 'stand'; }
        else { faceTo(A, frHere ? fr.x : -5.3, frHere ? fr.z : 9.4, dt); pose = frHere ? 'talk' : 'phone'; }
        if (A.state === 'wait') { faceTo(A, p.pos.x, p.pos.z, dt, 2); pose = 'stand'; if (st.T > A.hold) { A.state = 'sched'; A.waitFor = null; if (C.toldDrink && !C.drinks) { So.onCrowd(P, C); say(A, 'I will get my own, then.', 2.5); } } }
        if (A.gl.away > 0 && A.prospect) face(A, Math.atan2(A.x - p.pos.x, A.z - p.pos.z), dt, 3);      // turned away from a stare
        else if (A.gl.glow > 0 && A.prospect && pose !== 'lean') face(A, A.h + clamp(wrapA(Math.atan2(p.pos.x - A.x, p.pos.z - A.z) - A.h), -0.5, 0.5), dt, 2);
      }
      if (rf < 0.15) { if (withFr) { faceTo(fr, A.x, A.z, dt); frPose = spot === 'floor' ? 'dance' : A.arrived && (spot === 'huddle' || spot === 'sofa') ? 'talk' : 'stand'; } else frPose = f[1] < -2 ? 'lean' : 'stand'; if (!withFr && f[1] < -2) face(fr, Math.PI, dt); }
      // ordering at the bar: this is how you find out what they drink
      if (A.order) { A.order.t -= dt; if (A.order.t <= 0) { A.order = null; if (nearP(A) < 9) say(A, `${cap1(Lg.DRINKS[P.drink].name)}, please!`, 2.6); setCup(A, P.drink); } }
      // the two of them nattering (what they say is who they are)
      if ((A.sayT -= dt) <= 0) { A.sayT = 3.2 + Lg.hash('sy', P.seed, Math.floor(st.T / 3000)) * 3; if (frHere && A.arrived && pose === 'talk' && nearP(A) < 9 && !A.ch.saying && !fr.ch.saying) { A.chatI = (A.chatI || 0) + 1; if (A.chatI % 2) say(A, CHAT[P.taste][(A.chatI >> 1) % 4], 2.6); else say(fr, CHAT.friend[(A.chatI >> 1) % CHAT.friend.length], 1.6); } }
      // their friend drags them off once, mid-evening: wait, do not follow
      if (A.prospect && !A.dragged && C.met && !C.over && A.state === 'sched' && C.talks >= 2 && C.spark >= So.SPARK.noticed && C.spark < So.SPARK.close && Lg.hash('drag', P.seed, P.night) < 0.6 && !S.talk && S.partner !== A && nearP(A) < 8) {
        A.dragged = true; A.away = { until: st.T + 16000, warn: 0 }; say(fr, `${P.name}! Loo. NOW.`, 2.4); A.say2 = { text: 'Back in a minute!', t: 1.4 };
      }
      if (A.away && A.prospect && roomOf(p.pos.x, p.pos.z) === 'C' && nearP(A) < 3.2 && st.T > A.away.warn) { A.away.warn = st.T + 6000; So.onCrowd(P, C, 'follow'); say(fr, 'Are you FOLLOWING us?', 2.4); }
      if (A.prospect) { glance(A, dt, st); So.onIdle(P, C, dt); }
    } else if (A.state === 'talk') {
      faceTo(A, p.pos.x, p.pos.z, dt); pose = A.mood === 'bored' ? 'phone' : 'talk'; A.arrived = true;
      const f = AWAY[(P.i + 2) % AWAY.length]; if (go(fr, f[0], f[1], v, dt) < 0.15) faceTo(fr, A.x, A.z, dt, 2);
      if (S.talk && S.talk.A === A) talkTick(A, dt, st);
      else if (!S.invite || S.invite.A !== A) { A.state = 'sched'; }
      else if (nearP(A) > 6) { strip.close(); }
    } else if (A.state === 'dance') {
      const dn = A.dn; dn.said -= dt; dn.crowdCd = (dn.crowdCd || 0) - dt;
      const f = AWAY[(P.i + 2) % AWAY.length]; if (go(fr, f[0], f[1], v, dt) < 0.15) faceTo(fr, A.x, A.z, dt, 2);
      if (!onFloor(A.x, A.z, -0.4)) { go(A, clamp(p.pos.x, F.x0 + 1.2, F.x1 - 1.0), clamp(p.pos.z + 1.1, F.z0 + 0.8, F.z1 - 0.8), 1.5, dt); dn.wait = (dn.wait || 0) + dt; }
      else {
        // they keep their distance from you (closer as it goes well), drifting about the floor so you have to stay with them
        const d = nearP(A), on = onFloor(p.pos.x, p.pos.z, 0.5);
        const bf = st.beat || 0, ang = Lg.hash('dw', P.seed, Math.floor(bf / 16)) * 6.283;
        dn.wx += (Math.cos(ang) * 0.9 - dn.wx) * dt * 0.25; dn.wz += (Math.sin(ang) * 0.7 - dn.wz) * dt * 0.25;
        const rival = pt.scrap && pt.scrap.cut && pt.scrap.cut.A === A ? pt.scrap.cut : null;
        if (on && d > 0.05) {
          // (they drift round to the wall side of you, so the room — and the view from behind you — stays open)
          let ux = (A.x - p.pos.x) / d, uz = (A.z - p.pos.z) / d; const want = dn.gap;
          { const cx = p.pos.x - (F.x0 + F.x1) / 2, cz = p.pos.z - (F.z0 + F.z1) / 2, cl = Math.hypot(cx / 4.3, cz / 2.35); if (cl > 0.45) { const k = Math.min(0.5, (cl - 0.45) * 0.9), l0 = Math.hypot(cx, cz); ux += (cx / l0) * k; uz += (cz / l0) * k; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l; } }
          let tx = p.pos.x + ux * want + dn.wx * 0.5, tz = p.pos.z + uz * want + dn.wz * 0.5;
          tx = clamp(tx, F.x0 + 0.5, F.x1 - 0.5); tz = clamp(tz, F.z0 + 0.5, F.z1 - 0.5);
          const mx = tx - A.x, mz = tz - A.z, md = Math.hypot(mx, mz), s = Math.min(md, 0.9 * dt);
          if (md > 0.02) { A.x += (mx / md) * s; A.z += (mz / md) * s; A.speed = 0; }
          const toward = rival && rival.facing === 'him' && pt.scrap.rival ? Math.atan2(pt.scrap.rival.x - A.x, pt.scrap.rival.z - A.z) : Math.atan2(p.pos.x - A.x, p.pos.z - A.z);
          face(A, toward + (dn.miss >= 5 ? 0.7 : 0), dt, 6);
          dn.lost = 0;
        } else { dn.lost = (dn.lost || 0) + dt; if (dn.lost > 9) { stopDance(A, st, 'Where did you go?'); So.onCrowd(P, C); } }
        pose = 'dance';
        // their move on the beat: a step to the side, arms up, a dip
        const b = Math.round(bf), w = Math.cos(Math.PI * (bf - b)) ** 2, mv = So.partnerMove(P, b);
        A.tweak = (c) => moveTweak(c, mv, w);
        A.sway = mv === 'left' ? w : mv === 'right' ? -w : 0;
        if (dn.miss >= 5) A.headTo = 0.9;
      }
      if (dn.wait > 14) stopDance(A, st, 'Never mind, then.');
    } else if (A.state === 'lead') {
      // coat from the cloakroom, then up the stairs, waiting for you at the foot
      A.leadT += dt; go(fr, AWAY[2][0], AWAY[2][1], v, dt);
      if (A.leadPhase === 'coat') { const r = go(A, 7.1, -4.25, 1.4, dt); if (r < 0.15) { face(A, Math.PI, dt); A.coatT = (A.coatT || 0) + dt; if (A.coatT > 1.8) { A.leadPhase = 'foot'; if (!A.said.wave && nearP(fr) < 12) { A.said.wave = 1; say(fr, `Text me when you're home, ${P.name}!`, 3); } } } }
      else if (A.leadPhase === 'foot') { const r = go(A, 8.6, -3.3, 1.4, dt); if (r < 0.15) { faceTo(A, p.pos.x, p.pos.z, dt); if (nearP(A) < 4.5) { A.leadPhase = 'up'; say(A, 'Come on, then.', 2.2); } else if ((A.callT = (A.callT || 0) - dt) <= 0) { A.callT = 6; say(A, 'Are you coming?', 2.2); } if (A.leadT > 60) { A.state = 'sched'; C.over = true; C.why = 'stood up'; S.leaving = null; say(A, 'Forget it.', 2); } } }
      else { const r = go(A, 15.1, -3.3, 1.5, dt); if (r < 0.15) { A.state = 'gone'; A.ch.group.visible = false; A.vis = false; S.leaving = null; S.gone(A); if (pt.walk) pt.walk.begin(A.P, A.C, A.ch.look, A.cupKind); return; } }
    }
    // standing in their space
    if (A.prospect && A.state !== 'dance' && A.state !== 'lead' && A.state !== 'taxi' && A.vis) {
      const d = nearP(A); A.crowdT = d < 0.55 ? A.crowdT + dt : 0; A.snub = Math.max(0, (A.snub || 0) - dt);
      if (A.crowdT > 1.6) { A.crowdT = -3; So.onCrowd(P, C); say(A, P.mood === 'no' ? 'Can you NOT?' : 'Bit close!', 2); const ux = (A.x - p.pos.x) / Math.max(d, 0.05), uz = (A.z - p.pos.z) / Math.max(d, 0.05); A.x += ux * 0.5; A.z += uz * 0.5; }
    }
    if (A.say2) { A.say2.t -= dt; if (A.say2.t <= 0) { say(A, A.say2.text, 2.8); A.say2 = null; } }
    if (tip > 0.6 && pose !== 'drunk' && pose !== 'dance' && A.state === 'sched') pose = 'drunk';
    A.pose = pose; fr.pose = frPose; A.moving = A.speed > 0.1;
  }

  // ------------------------------------------------------------------ per frame
  const E = game.interact.add({ place: ID, radius: 2.1, pos: () => { const A = S.near; if (!A) return null; P3.set(A.x, A.y, A.z); return P3; },
    enabled: () => !!S.near && !strip.open && !S.scrap,
    label: () => { const A = S.near, C = A.C; return S.gift ? `Offer ${C.met && A.P.mood !== 'no' ? A.P.name : 'them'} the ${cap1(Lg.DRINKS[S.gift.kind].name).toLowerCase()}` : (C.met && A.P.mood !== 'no' ? `Talk to ${A.P.name}` : 'Say hello') + (S.canAsk ? '   [F] Ask to dance' : ''); },
    onUse: () => { const A = S.near; if (!A) return; if (S.gift) offer(A, S.st); else approach(A, S.st); } });
  let barSeen = false;
  void E;
  S.update = (dt, st) => {
    S.st = st; S.t += dt;
    if (S.night !== st.night || S.sex !== playerSex()) spawn(st);
    strip.update(dt);
    const p = game.player, cam = game.camera.position;
    S.avoid.length = 0;
    let near = null, nd = 2.2;
    for (const A of S.actors.values()) {
      try { actorTick(A, dt, st); } catch (e) { if (!A._err) console.error('[purple_turtle] social', A.key, e); A._err = true; }
      if (A.state === 'out' || A.state === 'gone') continue;
      S.avoid.push(A.x, A.z, A.fr.x, A.fr.z);
      if (A.prospect && !A.puppet && (A.state === 'sched' || A.state === 'wait') && !A.away) { const d = nearP(A); if (d < nd) { nd = d; near = A; } }
    }
    S.near = S.talk || S.invite || st.lightsUp || game.activity ? null : near;
    S.canAsk = !!S.near && S.near.C.met && S.near.C.spark >= So.SPARK.chatty && S.near.C.goodTalks >= 1 && !S.partner && !S.gift;
    if (S.canAsk && game.input.hit('KeyF')) {
      const A = S.near, r = So.onTalk(A.P, A.C, { mood: 'ask' }, 'dance', env(A, st)); A.C.talks--; A.C.inConvo--;
      meSay('Fancy a dance?'); A.say2 = { text: r.reply, t: 1.0 }; if (r.dance) startDance(A, st);
    }
    danceTick(dt, st); barTick(dt, st); drinkTick(dt, st); netTick(dt);
    // draw the nearest few (always whoever you are with)
    const list = [];
    for (const A of S.actors.values()) { if (A.state === 'out' || A.state === 'gone') { A.vis = A.fr.vis = false; A.ch.group.visible = A.fr.ch.group.visible = false; continue; }
      list.push([Math.hypot(A.x - cam.x, A.z - cam.z) - (A === S.partner || A === S.engaged || A.state === 'lead' ? 100 : 0), A, A], [Math.hypot(A.fr.x - cam.x, A.fr.z - cam.z) + 0.5, A.fr, A]); }
    list.sort((a, b) => a[0] - b[0]);
    list.forEach(([d, m, A], i) => {
      m.vis = i < 9 && d < 17; const g = m.ch.group; g.visible = m.vis; if (!m.vis) return;
      let x = m.x, z = m.z;
      if (m === A && A.sway) { x += Math.cos(A.h) * A.sway * 0.2; z += -Math.sin(A.h) * A.sway * 0.2; }
      g.position.set(x, m.y || 0, z); g.rotation.y = m.h;
      const pose = (m === A ? A.pose : A.fr.pose) || 'stand', moving = m.speed > 0.1;
      const want = moving && pose !== 'drunk' ? 'stand' : pose;
      if (m.ch.pose !== want) m.ch.setPose(want);
      if (want === 'dance' && st.beat !== undefined) m.ch.t = (st.beat + (m === A ? A.P.i * 2 : 3)) / 2.07 - dt;
      if (m === A) m.ch.headTurn(A.headTo || 0);
      m.ch.update(dt, m.speed || 0);
      if (m === A && A.headDown) m.ch.bones.head.rotation.x += A.headDown;
      if (m.tweak) m.tweak(m.ch);
    });
    for (const A of S.actors.values()) A.sway = 0;
    // people are solid enough: you cannot stand inside one
    if (!game.activity) for (const A of S.actors.values()) for (const m of [A, A.fr]) { if (!m.vis) continue; const dx = p.pos.x - m.x, dz = p.pos.z - m.z, d = Math.hypot(dx, dz); if (d < 0.42 && d > 1e-3) { const k = (0.42 - d) * 0.6; P3.set(p.pos.x + (dx / d) * k, 0, p.pos.z + (dz / d) * k); try { col.resolve(P3, 0.3); } catch { /* */ } p.pos.x = P3.x; p.pos.z = P3.z; } }
    if (st.dance) { const D = S.dance; st.dance.active = D.active; st.dance.streak = S.partner ? 0 : D.streak; st.dance.x = D.x; st.dance.z = D.z; }
    void tmpV;
  };
  /** leaving the cellar: glasses stay behind */
  S.leave = () => { strip.close(); if (S.cup) { S.cup.mesh.removeFromParent(); S.cup = null; } if (S.gift) { S.gift.mesh.removeFromParent(); S.gift = null; } S.dance.active = false; if (game.player.pose === 'dance') game.player.pose = 'stand'; S.ring.visible = false; S.talk = null; S.partner = null; S.bar.serving = null; for (const A of S.actors.values()) if (A.state === 'talk' || A.state === 'dance' || A.state === 'wait') A.state = 'sched'; };
  S.list = () => [...S.actors.values()].map((A) => ({ key: A.key, name: A.P.name, sex: A.P.sex, prospect: A.prospect, mood: A.P.mood, taste: A.P.taste, drink: A.P.drink, state: A.state, spot: A.spot || null, x: +A.x.toFixed(1), z: +A.z.toFixed(1), spark: +A.C.spark.toFixed(1), met: A.C.met, over: A.C.over, why: A.C.why, bearing: So.bearing(A.P, A.C), tipsy: +So.tipsy(A.P, S.st ? S.st.nh : 0).toFixed(2), glance: A.gl.phase, friendNear: Math.hypot(A.fr.x - A.x, A.fr.z - A.z) < 1.9, pose: A.pose, vis: A.vis }));
  S.get = (key) => S.actors.get(key);
  S.approach = (key) => approach(S.actors.get(key), S.st);
  S.offer = (key) => offer(S.actors.get(key), S.st);
  S.startDance = (key) => startDance(S.actors.get(key), S.st);
  S.clear = () => { for (const A of S.actors.values()) { freeChar(A.ch); freeChar(A.fr.ch); } S.actors.clear(); S.night = null; };
  return S;
}
