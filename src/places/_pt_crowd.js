// Purple Turtle — people inside: bar staff, the DJ, the pay desk and cloakroom, dancers, people leaning on the bar,
// someone asleep on a sofa, a table-football opponent, the toilet queue (gossip), friends who are "in town", a conga
// now and then, a ring of onlookers when the player dances well, and lights-up at 03:00 when everyone is herded out.
// Up to ~17 fully animated characters (only the nearest 9 drawn) + up to 44 instanced stand-ins at the back.
import * as THREE from 'three';
import * as Lg from './_pt_logic.js';
import { SPEECH, ambientLine } from '../systems/_street_lines.js';
import { LAY } from './_pt_interior.js';
import { clubLook, staffLook, makeChar, freeChar, congaTweak, sleepTweak, CLUB_LINES, GOSSIP_LINES, STAFF_LINES, DJ_LINES, CLOSE_LINES } from './_pt_chars.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const MAX_VIS = 9;
const TOPS = [0x111111, 0xc0182a, 0xeeeeea, 0x1d3fb0, 0xd81f78, 0x0e6a4a, 0xc8a850, 0x8fdcc4, 0xf07a6a, 0x2a2a3a, 0x6a2a9a, 0xe8c040];
const SKINS = [0xf2cdb0, 0xe8bc9a, 0xc99a74, 0x9c6b4a, 0x6e4a32, 0xf0d0b8];
const CONGA = [[-5.8, 1.6], [1.9, 1.6], [2.0, 0.3], [2.0, -1.7], [-4.5, -1.7], [-4.5, 0.3], [-5.8, 1.6]];
const CONGA_CUM = Lg.cumLen(CONGA);
const FOOT = [8.4, -3.3];

export function createCrowd(game, scene, room, audio) {
  const people = new Map();
  const C = { sig: '', t: 0, sayT: 3, djT: 8, visT: 0, congaUntil: -1, closingSaid: false, onlook: false, crowdSig: '', standinCount: 0 };
  const cam = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);

  function roster(st) {
    const out = [], d = st.density, n = st.night, s = st.state;
    if (!st.open && !st.lightsUp) return out;
    const staff = (key, seed, x, z, h, pose, lines, extra) => out.push({ key, look: () => staffLook(seed, extra), x, z, h, pose, lines, staff: true });
    staff('bar0', 3100 + (n % 7), -1.4, LAY.bar.staffZ, 0, 'stand', STAFF_LINES, { top: 0x2a0a40 });
    if (d > 0.3) staff('bar1', 3200 + (n % 5), 2.4, LAY.bar.staffZ, 0, 'stand', STAFF_LINES, { top: 0x2a0a40 });
    staff('cash', 3300 + (n % 3), LAY.cash.x, LAY.cash.z + 0.55, Math.PI, 'stand', ['Three quid, ta.', 'Hand out — stamp!', 'Free before half ten.']);
    staff('cloak', 3400, 7.1, LAY.cloak.z0 + 0.55, 0, 'stand', ['Coats a pound.', "Don't lose the ticket!"]);
    if (st.nh > 0.4) out.push({ key: 'dj', look: () => clubLook(3500 + (n % 4), 0.1, { prop: null }), x: LAY.dj.x - 0.55, z: LAY.dj.z, h: Math.PI / 2, pose: 'lean', lines: DJ_LINES, staff: true, dj: true });
    if (st.lightsUp) return out;
    const friends = (st.friends || []).slice(0, 3);
    const F = (i) => friends[i];
    const pat = (key, seed, x, z, h, pose, lines, extra) => out.push({ key, look: () => clubLook(seed, s, extra), x, z, h, pose, lines: lines || CLUB_LINES });
    const nd = st.social ? Math.round(1 + 2 * d) : Math.round(1 + 4 * d), dz = [[-0.4, 2.0], [1.5, 3.7], [0.2, 4.3], [-1.4, 3.2], [1.6, 5.2]];
    for (let i = 0; i < nd; i++) {
      const [x, z] = dz[i], h = -Math.PI / 2 + (Lg.hash('dh', n, i) - 0.5) * 1.6;
      if (i === 0 && F(1)) out.push({ key: 'f:' + F(1).id, look: F(1).look, x, z, h, pose: 'dance', lines: F(1).lines, label: F(1).label, friend: true, dancer: true });
      else { pat(`d${n}:${i}`, Lg.hash('dancer', n, i) * 1e9 | 0, x, z, h, 'dance'); out[out.length - 1].dancer = true; }
    }
    const nb = st.social ? 0 : d > 0.7 ? 2 : d > 0.2 ? 1 : 0, bz = [[-2.7, -2.95], [2.0, -2.95]];
    if (F(0)) out.push({ key: 'f:' + F(0).id, look: F(0).look, x: -1.2, z: -2.95, h: Math.PI, pose: 'lean', lines: F(0).lines, label: F(0).label, friend: true, barq: true });
    for (let i = 0; i < nb; i++) { pat(`b${n}:${i}`, Lg.hash('barq', n, i) * 1e9 | 0, bz[i][0], bz[i][1], Math.PI, 'lean'); out[out.length - 1].barq = true; }
    if (d > 0.1) { pat(`g${n}:0`, Lg.hash('foos', n) * 1e9 | 0, LAY.foos.x + 1.15, LAY.foos.z, -Math.PI / 2, 'stand', ['Your kick-off.', 'No spinning!', 'Best of five?']); out[out.length - 1].foos = true; }
    if (F(2)) out.push({ key: 'f:' + F(2).id, look: F(2).look, x: LAY.foos.x, z: LAY.foos.z + 1.25, h: Math.PI, pose: 'talk', lines: F(2).lines, label: F(2).label, friend: true });
    else if (d > 0.4) pat(`g${n}:1`, Lg.hash('foosw', n) * 1e9 | 0, LAY.foos.x, LAY.foos.z + 1.25, Math.PI, 'talk');
    if (st.nh > 2.5) { pat(`z${n}`, Lg.hash('asleep', n) * 1e9 | 0, LAY.sofaB.x + 0.12, LAY.sofaB.z - 0.45, Math.PI / 2, 'sit', ['Zzz...', 'Five more minutes...', 'Is it collections?']); out[out.length - 1].asleep = true; }
    if (d > 0.2) pat(`s${n}`, Lg.hash('sofa', n) * 1e9 | 0, LAY.sofaA.x - 0.4, LAY.sofaA.z - 0.12, Math.PI, 'sit', ['This is the quiet room. Ish.', 'My feet hurt.', 'Who has the cloakroom ticket?']);
    if (d > 0.3) pat(`t${n}:0`, Lg.hash('loo', n, 0) * 1e9 | 0, 10.25, 3.35, Math.PI / 2, 'stand', GOSSIP_LINES);
    if (d > 0.55) pat(`t${n}:1`, Lg.hash('loo', n, 1) * 1e9 | 0, 10.95, 3.4, -Math.PI / 2, 'talk', GOSSIP_LINES);
    return out;
  }

  function sync(st) {
    const specs = roster(st), sig = specs.map((s) => s.key).join(',');
    if (sig === C.sig) return;
    C.sig = sig;
    const keep = new Set(specs.map((s) => s.key));
    for (const [k, p] of people) if (!keep.has(k)) { freeChar(p.ch); people.delete(k); }
    for (const s of specs) {
      let p = people.get(s.key);
      if (!p) {
        p = { key: s.key, ch: makeChar(s.look(), scene), x: s.x, z: s.z, h: s.h, speed: 0, spec: s };
        if (s.label) p.ch.setLabel(s.label);
        p.ch.setPose(s.pose); people.set(s.key, p);
      }
      p.spec = s; p.hx = s.x; p.hz = s.z; p.hh = s.h;
    }
  }
  function exitPath(x, z) {
    const pts = [];
    if (x > LAY.X1 && z > 2.5) pts.push([8.4, 3.7]);
    if (z > LAY.R3.za - 0.3) { const o = LAY.open23.map(([a, b]) => [(a + b) / 2, 6.9]).sort((A, B) => Math.abs(A[0] - x) - Math.abs(B[0] - x))[0]; pts.push(o); x = o[0]; z = o[1]; }
    if (z > LAY.R2.za - 0.3) { const o = LAY.open12.map(([a, b]) => [(a + b) / 2, 0.3]).sort((A, B) => Math.abs(A[0] - x) - Math.abs(B[0] - x))[0]; pts.push(o, [o[0], -1.6]); }
    pts.push([FOOT[0], -1.8], FOOT, [14.6, -3.3]);
    return pts;
  }
  function walkTo(p, tx, tz, v, dt) {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { p.speed = 0; return 0; }
    const s = Math.min(d, v * dt); p.x += (dx / d) * s; p.z += (dz / d) * s; p.speed = dt > 0 ? s / dt : 0;
    p.h += wrapA(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 8);
    return d - s;
  }

  /** st: {open, lightsUp, density, state, nh, night, beatPhase, beat, dance:{active, streak, x, z}, friends, conga} */
  C.update = (dt, st) => {
    // shared clock (seconds within the hour), so the conga line, sways and arm swaps are in step for every player
    C.t = game.time && game.time.now ? (game.time.now() % 3600000) / 1000 : C.t + dt;
    if (C.congaUntil > C.t + 60) C.congaUntil = 0;                 // (the hour wrapped)
    // closing: everyone (not staff) heads for the stairs
    if (st.lightsUp && !C.leavingOn) {
      C.leavingOn = true; C.leaving = [];
      for (const p of people.values()) if (!p.spec.staff) { p.exit = exitPath(p.x, p.z); p.exitI = 0; C.leaving.push(p.spec); }
    }
    if (!st.lightsUp && C.leavingOn) { C.leavingOn = false; C.leaving = null; C.closingSaid = false; for (const p of people.values()) p.exit = null; C.sig = ''; }
    if (!C.leavingOn) sync(st);
    else for (const [k, p] of people) if (p.gone) { freeChar(p.ch); people.delete(k); }
    if (st.conga && C.congaUntil < C.t) C.congaUntil = C.t + 40;
    const conga = C.congaUntil > C.t && !st.lightsUp && !(st.dance && st.dance.active);
    const ringAt = st.fight || st.dance, onlook = !!st.fight || (st.dance && st.dance.active && st.dance.streak >= 12);
    let ci = 0, oi = 0;
    const dancers = [];
    for (const p of people.values()) if (!p.spec.staff && (p.spec.dancer || p.spec.barq)) dancers.push(p);
    for (const p of people.values()) {
      const s = p.spec, ch = p.ch;
      let pose = s.pose, tx = p.hx, tz = p.hz, th = p.hh, tweak = null;
      if (p.exit) {
        const w = p.exit[p.exitI]; const r = walkTo(p, w[0], w[1], 1.15, dt);
        if (r < 0.1) { p.exitI++; if (p.exitI >= p.exit.length) { p.gone = true; ch.group.visible = false; continue; } }
        if (ch.pose !== 'stand' && ch.pose !== 'drunk') ch.setPose('stand');
        p.y = Math.min(2.6, Math.max(0, (p.x - 9) / 5 * 2.6));
        continue;
      }
      p.y = 0;
      if (conga && dancers.includes(p)) {
        const k = dancers.indexOf(p), L = CONGA_CUM[CONGA_CUM.length - 1], sd = ((((C.t * 0.85 - k * 0.62) % L) + L) % L);
        const o = Lg.pointAt(CONGA, CONGA_CUM, sd, {}); tx = o.x; tz = o.z; th = o.h; pose = 'stand'; tweak = congaTweak;
        if (p.ch.pose === 'lean' || p.ch.pose === 'dance') ch.setPose('stand');
        const d = Math.hypot(tx - p.x, tz - p.z);
        if (d > 0.6) walkTo(p, tx, tz, 2.0, dt); else { p.speed = d / Math.max(dt, 1e-3); p.x = tx; p.z = tz; p.h += wrapA(th - p.h) * Math.min(1, dt * 6); }
        if (k === 0) { const cs = Math.floor(C.t / 7); if (cs !== C.congaS) { C.congaS = cs; if (Math.abs(Math.sin(cs * 91.7)) < 0.6) ch.say('CONGA!', 2); } }   // (shared slot: same shout for everyone)
      } else if (onlook && s.dancer) {
        const n = Math.max(3, dancers.length), a = (oi++ / n) * Math.PI * 2 + 0.4;
        const rr = st.fight ? 2.7 : 1.7; tx = ringAt.x + Math.sin(a) * rr; tz = ringAt.z + Math.cos(a) * rr; th = Math.atan2(ringAt.x - tx, ringAt.z - tz); pose = st.fight ? 'stand' : 'clap';
        const r = walkTo(p, tx, tz, 1.6, dt); if (r < 0.06) p.h += wrapA(th - p.h) * Math.min(1, dt * 6); else pose = 'stand';
        if (Math.random() < dt * 0.25 && !ch.saying) ch.say((st.fight ? ['Leave it!', 'Oh my GOD.', 'BOUNCER!', 'Not worth it!'] : ['GO ON!', 'YESSS!', 'Moves!', 'LEGEND!'])[Math.floor(Math.random() * 4)], 1.5);
      } else {
        const r = walkTo(p, tx, tz, 1.3, dt);
        if (r > 0.06) pose = 'stand'; else p.h += wrapA(th - p.h) * Math.min(1, dt * 4);
      }
      if (ch.pose !== pose) ch.setPose(pose);
      if (s.asleep) tweak = (c) => sleepTweak(c, C.t);
      if (s.dj) tweak = (c) => { c.bones.head.rotation.x += 0.12 * Math.abs(Math.sin(st.beatPhase * Math.PI)); };
      p.tweak = tweak; ci++;
    }
    // visibility: the nearest MAX_VIS within 15 m (always anyone within 3 m)
    cam.copy(game.camera.position);
    if ((C.visT -= dt) <= 0) {
      C.visT = 0.25;
      const arr = []; for (const p of people.values()) { if (p.gone) continue; p.cd = Math.hypot(p.x - cam.x, p.z - cam.z); arr.push(p); }
      arr.sort((a, b) => a.cd - b.cd);
      arr.forEach((p, i) => { p.vis = p.cd < 3 || (i < MAX_VIS && p.cd < 15); });
    }
    for (const p of people.values()) {
      if (p.gone) continue;
      const g = p.ch.group; g.visible = !!p.vis;
      if (!p.vis) continue;
      g.position.set(p.x, p.y || 0, p.z); g.rotation.y = p.h;
      // dancers keep time with the DJ: the 'dance' pose runs at 2.07 beats per second of character time, so set that time from the beat
      if (p.ch.pose === 'dance' && st.beat !== undefined && !st.lightsUp) { if (p.bo === undefined) p.bo = (Math.floor(p.x * 7 + p.z * 13) & 3) * 2; p.ch.t = (st.beat + p.bo) / 2.07 - dt; }
      p.ch.update(dt, p.speed); if (p.tweak) p.tweak(p.ch); if (p.xtweak) p.xtweak(p.ch);
    }
    // chatter
    const pl = game.player.pos;
    if ((C.sayT -= dt) <= 0) {
      C.sayT = SPEECH.club[0] + Math.random() * (SPEECH.club[1] - SPEECH.club[0]);   // (a fifth as often as it was: 2.2-4.2 s)
      let best = null, k = 0;
      for (const p of people.values()) { if (!p.vis || p.ch.saying || !p.spec.lines) continue; if (Math.hypot(p.x - pl.x, p.z - pl.z) > 9) continue; if (Math.random() * ++k < 1) best = p; }
      if (st.lightsUp) { for (const p of people.values()) if (p.spec.staff && p.vis && !p.ch.saying && Math.random() < 0.6) { p.ch.say(CLOSE_LINES[Math.floor(Math.random() * CLOSE_LINES.length)], 3); break; } }
      else if (best) best.ch.say(ambientLine(best.spec.lines, null, null, game.time.now() / 1000), 3);   // (not the line just heard, nor one from the last few minutes while there are others)
    }
    if ((C.djT -= dt) <= 0) { C.djT = 15 + Math.random() * 15; const dj = people.get('dj'); if (dj && !st.lightsUp) dj.ch.say(DJ_LINES[Math.floor(Math.random() * DJ_LINES.length)], 3); }
    // stand-ins
    standins(dt, st, pl);
  };

  function standins(dt, st, pl) {
    const slots = room.crowdSlots, B = room.crowdBody, U = room.crowdHead;     // B: arms down, U: arms up
    let want = st.lightsUp ? Math.max(0, C.standinCount - dt * 3) : Math.round(st.density * slots.length);
    if (!st.open && !st.lightsUp) want = 0;
    C.standinCount = want;
    const nWant = Math.floor(want);
    let nb = 0, nu = 0; C._n = nWant;
    const av = st.avoid || null;
    const beat = st.beatPhase, bob = Math.abs(Math.sin(beat * Math.PI)), bar = Math.floor(C.t);              // swap roughly every couple of beats
    const skinB = B.geometry.attributes.instSkin, skinU = U.geometry.attributes.instSkin;
    for (let i = 0; i < slots.length && i < nWant; i++) {
      const [x, z, kind] = slots[i];
      const r = Lg.hash('si', st.night, i);
      const dance = kind === 'dance' && !st.lightsUp, yb = dance ? 0.05 * bob * (0.6 + r) : 0;
      const yaw = (dance ? -Math.PI / 2 : r * 6.28) + Math.sin(C.t * (1.5 + r) + i) * (dance ? 0.35 : 0.08);
      q.setFromAxisAngle(up, yaw); pv.set(x + Math.sin(C.t * 0.7 + i) * 0.04, yb, z);
      let s = Math.hypot(x - pl.x, z - pl.z) < 3.6 || Math.hypot(x - cam.x, z - cam.z) < 3.2 ? 0 : 0.92 + r * 0.16;     // too close to the player: hide (a real person would be there)
      if (s && av) for (let k = 0; k < av.length; k += 2) if (Math.abs(x - av[k]) < 0.75 && Math.abs(z - av[k + 1]) < 0.75) { s = 0; break; }      // (…and where one of tonight's real people is standing)
      sc.set(s * (0.9 + 0.2 * Lg.hash('sb', i)), s, s);
      m4.compose(pv, q, sc);
      // about a third of the dancers throw their arms up, swapping every couple of beats
      const upArms = dance && Lg.hash('su', st.night, i) < 0.35 && (bar + i) % 3 !== 0;
      const M = upArms ? U : B, k = upArms ? nu++ : nb++, SK = upArms ? skinU : skinB;
      M.setMatrixAt(k, m4);
      M.setColorAt(k, col.setHex(TOPS[Math.floor(Lg.hash('st', st.night, i) * TOPS.length)]));
      col.setHex(SKINS[Math.floor(Lg.hash('sk', st.night, i) * SKINS.length)]); SK.setXYZ(k, col.r, col.g, col.b);
    }
    B.count = nb; U.count = nu;
    for (const M of [B, U]) { M.instanceMatrix.needsUpdate = true; if (M.instanceColor) M.instanceColor.needsUpdate = true; M.geometry.attributes.instSkin.needsUpdate = true; }
  }
  C.list = () => [...people.values()].filter((p) => !p.gone).map((p) => ({ key: p.key, pose: p.ch.pose, x: +p.x.toFixed(1), z: +p.z.toFixed(1), vis: !!p.vis, label: p.spec.label || null, role: p.spec.staff ? 'staff' : p.spec.friend ? 'friend' : 'patron' }));
  C.count = () => ({ animated: [...people.values()].filter((p) => !p.gone).length, drawn: [...people.values()].filter((p) => p.vis && !p.gone).length, standins: room.crowdBody.count + room.crowdHead.count });
  /** the bar staff (the night's social life catches their eye: _pt_social.js) */
  C.bartenders = () => { const out = []; for (const k of ['bar0', 'bar1']) { const p = people.get(k); if (p && !p.gone) out.push(p); } return out; };
  C.patrons = () => { const out = []; for (const p of people.values()) if (!p.spec.staff && !p.gone && p.vis) out.push(p); return out; };
  /** how many of the crowd's places within r of (x, z) are taken (they are not drawn right beside you, but they are there to barge into) */
  C.standinsNear = (x, z, r) => { let n = 0; const slots = room.crowdSlots; for (let i = 0; i < slots.length && i < (C._n || 0); i++) if (Math.abs(slots[i][0] - x) < r && Math.abs(slots[i][1] - z) < r) n++; return n; };
  C.foosOpponent = () => { for (const p of people.values()) if (p.spec.foos) return p; return null; };
  C.clear = () => { for (const p of people.values()) freeChar(p.ch); people.clear(); C.sig = ''; };
  return C;
}
