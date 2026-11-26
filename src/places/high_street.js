// The High Street curve, c. 2013 (batch 6) — see docs/research/landmarks_batch6.md (sources; known vs guessed).
//
//   preMap   the generic Queen's Front Quad and its lodge, All Souls' High Street ranges, gate tower and Warden's
//            Lodgings, University College's High Street ranges and gate passages are skipped (rebuilt here); the
//            Examination Schools' mapped outline loses its front block (rebuilt here; the wings and the Merton Street
//            quad stay the world's)
//   install  Queen's screen and cupola (Queen Caroline inside it) between the two pedimented ends of the Front Quad,
//            All Souls' battlemented front with its gate tower and statue niches and the classical Warden's Lodgings,
//            Univ's long gabled front with its two gate towers, the Examination Schools' Jacobean front, porch and
//            louvre — LOD groups in the ONE batch-5 atlas draw (_b5_kit.js: no draw call added). St Mary's porch and
//            All Souls' twin towers are radcliffe_square.js's and are not touched.
//   game     "The Three Queens of the High": look up at Queen Caroline, Queen Anne and Queen Mary (£3 when you have
//            found all three, once); ask at All Souls' lodge; walk into the Examination Schools and sit a paper (a
//            45-second exam, three questions from the day's paper, a class, £5 for a First once a game day)
//
// Test hooks: game.highStreet = { sights, stats(), queens(), sit(), answer(i), exam(), enter() }  tools/smoke_batch6.mjs
import * as THREE from 'three';
import { randomLook } from '../core/characters.js';
import { shared, addSite, corners, DAY_MS } from './_b5_kit.js';
import { QN, AS, UC, EX, buildQueens, buildAllSouls, buildUniv, buildSchools, schoolsRest, solids, passages } from './_b6_high.js';
import { sidePt, sideToward } from './_b6_kit.js';
import { ROOM as RD, DESKS, FREE, deskPos, QUESTIONS, paper, mark, EXAM_SECS, INVIGILATOR, contents, ROOM_SL, DESKS_SL, FREE_SL, deskPosSL, outsideTint } from './_b6_exam.js';
import { planWalkin, kitGaps, cityDoor, glazing, mergeRoom, warmLater, dressOpenings, archLining, roomCrowd, cityDoorMats } from './_walkin_city.js';
import { ROOFSCAPE } from '../world/landmarks.js';

const OFF = (typeof location !== 'undefined' && /[?&]b6=0\b/.test(location.search || '')) || (typeof process !== 'undefined' && !!(process.env && process.env.B6OFF));
export const IDS = {
  queens: ['w27151764', 'w227502403'],
  allsouls: ['w301650424', 'w227661665', 'w301650413', 'w301774452', 'w301650428', 'w301650431'],
  univ: ['w297525315', 'w297525321', 'w297525322', 'w297760074', 'w297913656', 'w297525323', 'w297525324', 'w297525327', 'w297525330', 'w297525317'],
  schools: EX.id,
};
export const SKIP = [...IDS.queens, ...IDS.allsouls, ...IDS.univ];
const ROOMID = 'b6_exam_schools';
const mid = (R) => [R.cx, R.cz];
export const sights = [
  { id: 'hs-queens', name: 'The Queen\'s College on the High', x: QN.gateAt[0], z: QN.gateAt[1] + 4, blurb: 'The screen and cupola of 1733-36, Hawksmoor\'s design built by William Townesend, between the tall pedimented ends of the Front Quad. Queen Caroline, who paid for much of it, stands inside the cupola.' },
  { id: 'hs-allsouls', name: 'All Souls\' High Street front', x: mid(AS.tower)[0], z: mid(AS.tower)[1] + 6, blurb: 'Archbishop Chichele\'s college of 1438: the old front quad faces the High, with Henry VI and the founder in the niches over the gate. It has fellows but no undergraduates.' },
  { id: 'hs-univ', name: 'University College', x: mid(UC.t1)[0], z: mid(UC.t1)[1] - 7, blurb: 'The long gabled front of the Main Quad (1634-77) and the Radcliffe Quad (1716-19), each behind its own gate tower: Queen Anne looks out over one gate, Queen Mary over the other.' },
  { id: 'hs-schools', name: 'The Examination Schools', x: EX.door[0], z: EX.door[1] - 3, blurb: 'T. G. Jackson\'s Jacobean front of 1876-82, the first Clipsham stone in Oxford. The carvings over the door show a viva voce exam and a degree day; finalists come out of the Merton Street side to be "trashed".' },
  { id: 'hs-curve', name: 'The curve of the High', x: 600, z: 252, blurb: 'The bend of the High between Queen\'s and Univ, the view the guidebooks call one of the finest streets in Europe: the spire of St Mary\'s behind you, Magdalen Tower ahead.' },
];
/** the three queens: [id, name, the [E] spot on the pavement, the line] */
export const QUEENS = [
  ['caroline', 'Queen Caroline', sidePt(QN.gate, 0, 0, 5.2), 'Queen Caroline, in the cupola over Queen\'s gate. She paid for the rebuilding; the college is named after a different queen, Philippa, wife of Edward III.'],
  ['anne', 'Queen Anne', sidePt(UC.t1, 0, 0, 4.6), 'Queen Anne, over Univ\'s Main Quad gate since 1709. Inside the quad, over the same gate, is James II.'],
  ['mary', 'Queen Mary', sidePt(UC.t2, 0, 0, 4.6), 'Queen Mary II, over the Radcliffe Quad gate (1719). Dr Radcliffe, who paid for the quad, stands on the other side.'],
];
export const PORTER = [
  'All Souls\' porter: "Fellows only, I\'m afraid. No undergraduates here. Never have been."',
  'All Souls\' porter: "The exam for a fellowship used to have a one-word essay. You\'d be given the word on the day."',
  'All Souls\' porter: "Once a century they sing the Mallard song and go looking for a duck on the roof. Last time was 2001. You\'ve missed it."',
  'All Souls\' porter: "The twin towers? Round the back, on Radcliffe Square. Mr Hawksmoor\'s."',
  'All Souls\' porter: "The college is for all the souls of the faithful departed. Very quiet. Please keep it that way."',
];
export const porterLine = (day) => PORTER[((day % PORTER.length) + PORTER.length) % PORTER.length];

export default {
  id: 'high_street',
  preMap(game) {
    if (OFF) return;
    try {
      for (const id of SKIP) game.overrides.skip.add(id);
      const b = game.map && game.map.buildings.find((q) => q.id === IDS.schools), rest = b && schoolsRest(b.poly);
      if (rest) { b.poly = rest; b.c = [rest.reduce((s, p) => s + p[0], 0) / rest.length, rest.reduce((s, p) => s + p[1], 0) / rest.length]; }
    } catch (e) { console.error('[high_street] preMap', e); }
  },

  install(game) {
    if (OFF) return { update() {} };
    const K = shared(game), me = K.join('high_street'), W = game.world, col = game.worldCollider;
    const S = { err: false, found: new Set(), paid: false, asked: 0, exam: null, exams: 0, last: null, people: [] };
    try {
      const flags = (game.state && game.state.flags) || {};
      for (const q of (flags.b6Queens || '').split(',').filter(Boolean)) S.found.add(q);
      S.paid = !!flags.b6QueensPaid;
      addSite(K, 'hs:queens', [QN.gate.cx, 10, QN.gate.cz - 20], 38, [110, 200, 900], buildQueens, { farArea: 0.4 });
      addSite(K, 'hs:allsouls', [500, 8, 240], 42, [100, 180, 650], buildAllSouls, { farArea: 0.4 });
      addSite(K, 'hs:univ', [562, 8, 266], 52, [100, 190, 700], buildUniv, { farArea: 0.4 });
      addSite(K, 'hs:schools', [EX.front.cx, 12, EX.front.cz], 26, [110, 200, 900], buildSchools, { farArea: 0.4 });
      K.boxes.push([455, 712, 175, 300]);
      for (const p of solids()) col.addPolygon(p);
      for (const [x1, z1, x2, z2, w] of Object.values(passages())) col.addPassage(x1, z1, x2, z2, w);
      // nothing of the street furniture left standing inside a projecting tower or the porch
      if (W && W.clearArea) for (const R of [QN.gate, AS.tower, UC.t1, UC.t2, EX.porch]) W.clearArea([sidePt(R, 0, -R.L / 2 - 0.4, 1.0), sidePt(R, 0, R.L / 2 + 0.4, 1.0), sidePt(R, 0, R.L / 2 + 0.4, -1.0), sidePt(R, 0, -R.L / 2 - 0.4, -1.0)], { trees: false });
      // the Schools' porch columns
      { const P = EX.porch, st = 0; for (const x of [-3.2, -1.7, 1.7, 3.2]) { const p = sidePt(P, st, x, 0.55); col.addCircle(p[0], p[1], 0.42); } }
      // lanterns at the gates
      try { for (const R of [QN.gate, AS.tower, UC.t1, UC.t2]) for (const dx of [-2.2, 2.2]) { const p = sidePt(R, 0, dx, 0.35); W.addLampGlow(p[0], 3.6, p[1]); } } catch { /* stub */ }
      for (const [id, name, pos, line] of QUEENS) game.interact.add({ pos, radius: 2.4, label: 'Look up at ' + name, onUse: () => lookUp(id, line) });
      game.interact.add({ pos: sidePt(AS.tower, 0, 0, 1.2), radius: 2.0, label: 'Ask at the All Souls lodge', onUse: () => ask() });
    } catch (e) { console.error('[high_street] build', e); } finally { K.joined(me); }

    function lookUp(id, line) {
      const fresh = !S.found.has(id); S.found.add(id);
      const flags = game.state.flags || (game.state.flags = {});
      flags.b6Queens = [...S.found].join(',');
      let msg = line + (fresh ? `  (Queens of the High: ${S.found.size} of 3)` : '');
      if (S.found.size >= 3 && !S.paid) { S.paid = true; flags.b6QueensPaid = 1; game.pay(3); msg += ' All three found: a guide on the corner tips you £3 for the tour.'; }
      try { game.save(); } catch { /* */ }
      try { game.ui.toast(msg, 6); } catch { /* */ }
      return { found: S.found.size, paid: S.paid };
    }
    function ask() { S.asked++; const l = porterLine(Math.floor(game.time.now() / DAY_MS)); try { game.ui.toast(l, 6); } catch { /* */ } return l; }

    // ---------------------------------------------------------------- the North School (walk in from the High)
    // Walk-in (core/interiors.js "seamless"; _walkin_city.js): the room lies along the front block (_b6_exam.js ROOM_SL),
    // behind the porch: the doorway is the porch's round-headed entrance (its painted door is recessed 0.6 m in the
    // porch face, which stands 2.4 m forward of the front), so the way in is 2.7 m deep, lined in stone. The four
    // ground-floor windows of the street front (three lights each, where _b6_high.js buildSchools draws them) are real
    // openings onto the High; the back wall is the party wall with the rest of the Schools (no windows).
    const SLW = { t: 0.2, clear: 0.4, fwd: 2.4, rec: EX.doorway.rec, doorW: EX.doorway.w, doorH: EX.doorway.h };      // (fwd: the porch face, measured: frontRect's `fwd: 1.6` puts it 2.4 m forward of the front)
    const schoolsOutline = () => {      // the front block with the porch bump (the plan's shell)
      const R = EX.front, hl = R.L / 2, P = (x, z) => sidePt(R, 0, x, z);
      return [P(-hl, 0), P(-3.9, 0), P(-3.9, SLW.fwd), P(3.9, SLW.fwd), P(3.9, 0), P(hl, 0), P(hl, -R.W), P(-hl, -R.W)];
    };
    const frontWins = () => {           // [centre along the front, width, y0, y1] of the ground-floor windows
      const L = EX.front.L, sideC = (L / 2 - 7.2 + 3.9) / 2, sideW = L / 2 - 7.2 - 3.9;
      return ROOFSCAPE ? [-1, 1].flatMap((sg) => [sg * (sideC - sideW * 0.24), sg * (sideC + sideW * 0.24)]).map((x) => [x, sideW * 0.4, 1.5, 6.7]) : [-11.2, -6.6, 6.6, 11.2].map((x) => [x, 2.6, 1.8, 6.4]);
    };
    let plan = null;
    try {
      const xw = ROOM_SL.w / 2, wall = SLW.clear + SLW.fwd;
      // (room +z runs along the front the same way as the front's own x: both are "to the right seen from inside"… the
      //  windows are symmetric about the door, so only the door needs to be exact)
      plan = planWalkin(game, { id: ROOMID, building: schoolsOutline(), door: { pos: EX.door, facing: Math.atan2(EX.door[0] - EX.front.cx, EX.door[1] - EX.front.cz) },
        portal: { at: [xw + SLW.t / 2, 0], out: Math.PI / 2, w: SLW.doorW, h: SLW.doorH }, rects: [[-xw, -ROOM_SL.d / 2, xw, ROOM_SL.d / 2]], wall: wall - SLW.t / 2, mid: [0, 2.2], route: [[xw - 0.7, 0], [xw - 0.7, 2.2]],
        windows: frontWins().map(([z, w, y0, y1]) => ({ at: [xw, z], out: Math.PI / 2, w, y0, y1, proud: 0.03 - 0.3 })) });
      plan.seamless.portals[0].proud = 0.03 - SLW.rec;
      plan.seamless.bounds = [{ x0: -xw, x1: xw, z0: -ROOM_SL.d / 2, z1: ROOM_SL.d / 2, y0: 0, y1: ROOM_SL.h }];
    } catch (e) { console.error('[high_street] schools plan', e); }
    const outH = (() => { const n = [EX.door[0] - EX.front.cx, EX.door[1] - EX.front.cz]; return Math.atan2(n[0], n[1]); })();
    let inside = null;
    game.interiors.register({
      id: ROOMID, name: 'the Examination Schools', background: 0x1a1612, ambient: 0.9,
      doors: [{ pos: EX.door, facing: outH, label: 'Go into the Examination Schools' }],
      seamless: plan && plan.fit.ok ? plan.seamless : null,
      build(ctx) { inside = ctx.seamless && plan ? buildRoomSL(ctx) : buildRoom(ctx); return { spawn: inside.spawn, heading: inside.heading ?? Math.PI }; },
      onEnter() { try { game.ui.toast('The North School. Rows of desks, a clock, an invigilator, and the smell of floor polish and fear.', 5); } catch { /* */ } },
      update(dt) { tickExam(dt); roomTick(dt); },
      updateShown(dt) { roomTick(dt); },
    });
    if (plan) warmLater(game, ROOMID);
    // The outside of the four great windows (second pass): each is three lights between the shell's own stone mullions
    // (real piers with reveals, _b6_high.js); the stone transoms across them are drawn here in the world, at the glass,
    // lit as the wall is — Jackson's mullion-and-transom windows. No timber frame.
    const CLIP = 0xc9bc98;
    try { if (plan && plan.fit.ok) dressOpenings(game, ROOMID, [{ o: plan.seamless.openings.map((_, i) => i), mullions: 2, mullW: 0.16, transoms: [0.36, 0.7], stone: CLIP, fill: false }]); } catch (e) { console.warn('[high_street] schools dressing', e); }
    // Who is in the North School, whenever it is shown (seen through the windows from the High): candidates at their
    // desks and the invigilator in the two daily sessions (9.30-12.30, 2.30-5.30: GUESS at the real timetable), the
    // invigilator and a porter between them, nobody and no lights at night. The same people for every player.
    const hourNow = () => (game.time.pinned != null ? game.time.pinned : game.time.hour);
    const session = () => { const h = hourNow(); return (h >= 9.5 && h < 12.5) || (h >= 14.5 && h < 17.5); };
    const staffed = () => { const h = hourNow(); return h >= 8.5 && h < 18; };
    const crowd = roomCrowd(game, ROOMID, { cap: 13, signature: () => (session() ? 'exam' : staffed() ? 'day' : 'night'), populate(sp) {
      S.people.length = 0; S.invig = null;
      if (!staffed() || !inside) return;
      const SLm = !!inside.sl, rd = SLm ? ROOM_SL : RD, DK = SLm ? DESKS_SL : DESKS, fr = SLm ? FREE_SL : FREE, dp = SLm ? deskPosSL : deskPos;
      S.invig = sp(0, -rd.d / 2 + 3.4, randomLook('b6-invigilator', { outfit: 'tweed' }), { heading: 0, label: 'Invigilator', lines: ['"Silence in the Schools, please."', '"Candidates may not leave in the first half hour."'] });
      if (SLm) sp(rd.w / 2 - 1.3, -2.8, randomLook('b6-schools-porter', { outfit: 'porter' }), { heading: Math.PI / 2 + 0.5, label: 'Porter' });
      if (!session()) return;
      for (let r = 0; r < DK.rows; r++) for (let cc = 0; cc < DK.cols; cc++) {
        if (fr.some(([a, b]) => a === cc && b === r)) continue;
        if ((cc * 5 + r * 3) % 4) continue;   // about a quarter of the desks are taken
        const [x, z] = dp(cc, r);
        const p = sp(x, z + 0.55, randomLook('b6-candidate-' + cc + '-' + r, { outfit: 'gown' }), { heading: Math.PI, pose: 'write', label: '' }); if (p) S.people.push(p);
      }
    } });
    function roomTick(dt) { try { if (inside && inside.setLight) inside.setLight(staffed() ? 0.68 + 0.32 * (1 - (game.time.daylight ?? 1)) : 0.07);   /* (by day a little under the daylight outside: the windows are not white from the street) */ crowd.tick(dt); } catch { /* */ } }
    function buildRoom(ctx) {
      const s = ctx.scene, Kit = W.interiorKit, c = ctx.collider, { w, d, h } = RD;
      Kit.room(s, { w, d, h, floor: 'wood', walls: 'plaster', wainscot: 'panelling', collider: c, doors: [{ wall: 's', at: 0, width: 2.0, height: 3.0 }] });
      const C = contents();
      const m = new THREE.Mesh(C.geo, new THREE.MeshLambertMaterial({ vertexColors: true, name: 'b6:exam-furniture' })); m.name = 'b6:exam-furniture'; s.add(m);
      for (const [x, z, bw, bd] of C.solids) c.addBox(x, z, bw, bd, 0);
      // tall mullioned windows on the long walls (bright panes), a notice board, the lights
      const pane = new THREE.MeshBasicMaterial({ color: 0xb4c4d2, name: 'b6:exam-pane' });
      for (const sx of [-1, 1]) for (let z = -d / 2 + 3.5; z < d / 2 - 2; z += 4) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), pane); p.position.set(sx * (w / 2 - 0.16), 6.0, z); p.rotation.y = -sx * Math.PI / 2; s.add(p); }
      s.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4a34, 1.35));
      for (const z of [-10, -2, 6, 12]) Kit.warmLight(s, { x: 0, y: h - 2.2, z, intensity: 8, distance: 18 });
      ctx.addExit(0, d / 2 - 0.9, 'Out to the High');
      // candidates at their desks (writing), the invigilator on the dais (an invented, unnamed don)
      // (the people: roomCrowd above)
      for (const [cc, r] of FREE) { const [x, z] = deskPos(cc, r); game.interact.add({ place: ctx.id, pos: [x, z + 0.9], radius: 1.3, label: 'Sit the exam', enabled: () => !S.exam, onUse: () => sit([x, z]) }); }
      game.interact.add({ place: ctx.id, pos: [0, d / 2 - 3], radius: 2.0, label: 'Read the notice', onUse: () => { try { game.ui.toast('NOTICE: Candidates must wear sub fusc. Mobile telephones must be switched off. Do not turn over your paper until told to.', 6); } catch { /* */ } } });
      return { spawn: [0, d / 2 - 2.2] };
    }
    /** the walk-in North School: ROOM_SL along the front block, the street door in its +x wall */
    function buildRoomSL(ctx) {
      const s = ctx.scene, Kit = W.interiorKit, c = ctx.collider, { w, d, h } = ROOM_SL, xw = w / 2, pt = plan.seamless.portals[0];
      Kit.room(s, { w, d, h, floor: 'wood', walls: 'plaster', wainscot: null, collider: c, doors: kitGaps(plan) });
      const gaps = [[-pt.w / 2 - 0.1, pt.w / 2 + 0.1, 0, pt.h], ...plan.seamless.openings.map((o) => [o.at[1] - o.w / 2 - 0.05, o.at[1] + o.w / 2 + 0.05, o.y0, o.y1])];
      const C = contents({ room: ROOM_SL, desks: DESKS_SL, deskPos: deskPosSL, gaps });
      const m = new THREE.Mesh(C.geo, new THREE.MeshLambertMaterial({ vertexColors: true, name: 'b6:exam-furniture' })); m.name = 'b6:exam-furniture'; s.add(m);
      for (const [x, z, bw, bd] of C.solids) c.addBox(x, z, bw, bd, 0);
      // (the room's side of the windows: stone reveals, plain glass; the transoms are the world's — dressOpenings above)
      { const st = new THREE.MeshLambertMaterial({ color: 0xcfc2a2, side: THREE.DoubleSide, name: 'b6:exam-reveal' }); s.add(glazing(plan.seamless.openings, { frame: 0.001, bars: 0, mats: { ...cityDoorMats(), frame: st, reveal: st } })); s.add(outsideTint(plan.seamless.openings, { opacity: 0.55, inset: 0.2 })); }   // (inset: inside the plane the opening is punched at)
      // the round head of the doorway, from inside: its soffit right through the porch (a short barrel vault)
      { const lin = archLining(null, [{ at: pt.at, out: pt.out, w: pt.w, y0: 0, y1: pt.h, depth: pt.depth, head: 'round', rise: pt.w / 2 }], { color: 0xcfc2a2 }); if (lin) s.add(lin); }
      // inside the door: a mat, the notice board (the one you can read), a brass stand with the day's seating plan
      { const bx = (x, y, z, w, h, dd, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), new THREE.MeshLambertMaterial({ color: col })); m.position.set(x, y, z); s.add(m); };
        bx(xw - 1.0, 0.012, 0, 1.5, 0.02, 1.7, 0x4a3a2c);
        bx(xw - 0.17, 1.95, 3.2, 0.05, 1.0, 1.5, 0x2e2016); bx(xw - 0.2, 1.95, 3.2, 0.02, 0.86, 1.36, 0x35503a);
        for (const [dz, dy, w, h] of [[-0.42, 0.14, 0.3, 0.42], [0.02, 0.1, 0.36, 0.5], [0.44, 0.18, 0.26, 0.36], [-0.1, -0.26, 0.42, 0.22]]) bx(xw - 0.215, 1.95 + dy, 3.2 + dz, 0.01, h, w, 0xf0ece0);
        bx(xw - 1.2, 0.6, -1.5, 0.05, 1.2, 0.05, 0x8a7a3a); bx(xw - 1.2, 1.3, -1.5, 0.04, 0.5, 0.4, 0xf0ece0); bx(xw - 1.2, 0.02, -1.5, 0.3, 0.04, 0.3, 0x8a7a3a); }
      // the way in through the porch: stone sides and soffit from the room's wall out to the porch's doorway
      { const x0 = xw + SLW.t / 2, x1 = x0 + pt.depth - SLW.rec + 0.05, hw = pt.w / 2, P = [], N = [];
        const q = (a, b, cc, dd, n) => { for (const v of [a, b, cc, a, cc, dd]) { P.push(...v); N.push(...n); } };
        q([x0, 0, -hw], [x1, 0, -hw], [x1, pt.h, -hw], [x0, pt.h, -hw], [0, 0, 1]); q([x1, 0, hw], [x0, 0, hw], [x0, pt.h, hw], [x1, pt.h, hw], [0, 0, -1]);
        q([x0, pt.h, -hw], [x1, pt.h, -hw], [x1, pt.h, hw], [x0, pt.h, hw], [0, -1, 0]); q([x0, 0.002, hw], [x1, 0.002, hw], [x1, 0.002, -hw], [x0, 0.002, -hw], [0, 1, 0]);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        const lm = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xcfc2a2, side: THREE.DoubleSide, name: 'b6:exam-porch' })); lm.name = 'b6:exam-porch'; s.add(lm); }
      cityDoor(ctx, plan, { style: 'oak', heavy: true, hinge: 1 });
      s.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4a34, 1.35));
      for (const z of [-10, -2, 6, 12]) Kit.warmLight(s, { x: 0, y: h - 2.2, z, intensity: 8, distance: 18 });
      mergeRoom(s);
      // by the hour: every light of the room scaled together (dark when the Schools are shut: seen from the High)
      const lights = []; s.traverse((o) => { if (o.isLight) lights.push([o, o.intensity]); });
      let litK = 1; const setLight = (k) => { if (Math.abs(k - litK) < 0.01) return; litK = k; for (const [l, i] of lights) l.intensity = i * k; };
      for (const [cc, r] of FREE_SL) { const [x, z] = deskPosSL(cc, r); game.interact.add({ place: ctx.id, pos: [x, z + 0.9], radius: 1.3, label: 'Sit the exam', enabled: () => !S.exam, onUse: () => sit([x, z]) }); }
      game.interact.add({ place: ctx.id, pos: [xw - 0.9, 3.2], radius: 1.6, label: 'Read the notice', onUse: () => { try { game.ui.toast('NOTICE: Candidates must wear sub fusc. Mobile telephones must be switched off. Do not turn over your paper until told to.', 6); } catch { /* */ } } });
      return { spawn: [xw - 1.4, 0], heading: -Math.PI / 2, sl: true, setLight };
    }
    /** sit the day's paper: the invigilator starts the clock; [1]-[3] answer each question in turn; pens down at 45 s */
    function sit(at) {
      if (S.exam) return false;
      const day = Math.floor(game.time.now() / DAY_MS), p = paper(day);
      S.exam = { day, p, k: 0, answers: [], t: 0, said: -1, at: at || [0, 0] };
      const show = () => { const q = QUESTIONS[p[S.exam.k]]; try { game.ui.toast(`Q${S.exam.k + 1}. ${q[0]}   [1] ${q[1][0]}   [2] ${q[1][1]}   [3] ${q[1][2]}`, 12); } catch { /* */ } };
      S.exam.show = show;
      try {
        game.beginActivity({
          name: 'b6-exam', hint: 'Sitting the paper: [1] [2] [3] to answer, Esc to walk out.',
          onKey(code) { const i = { Digit1: 0, Digit2: 1, Digit3: 2 }[code]; if (i !== undefined) answer(i); },
          update() { /* the clock runs in tickExam (the room's update) */ },
          onEnd() { if (S.exam && !S.exam.done) finish(true); },
        });
      } catch (e) { console.warn('[high_street] exam', e); }
      try { game.ui.toast(INVIGILATOR[0], 4); } catch { /* */ }
      S.exam.showAt = 1.5;
      return true;
    }
    function answer(i) {
      const E = S.exam; if (!E || E.done || E.showAt > 0) return null;
      E.answers[E.k] = i; E.k++;
      if (E.k >= E.p.length) { finish(false); return 'done'; }
      E.show(); return E.k;
    }
    function finish(walkedOut) {
      const E = S.exam; if (!E || E.done) return null;
      E.done = true;
      const r = mark(E.day, E.answers), flags = game.state.flags || (game.state.flags = {});
      let paid = false;
      if (r.cls === 'First' && flags.b6First !== E.day) { flags.b6First = E.day; game.pay(5); paid = true; try { game.save(); } catch { /* */ } }
      S.exams++; S.last = { ...r, walkedOut, paid };
      const msg = walkedOut && r.answered < E.p.length ? `You walk out of the Schools. The examiners award a ${r.cls} on what you wrote (${r.right} of ${E.p.length}).` : `${INVIGILATOR[3]}  Results, posted at once: a ${r.cls} (${r.right} of ${E.p.length}).${paid ? ' Your college gives you £5 for the First.' : r.cls === 'Third' ? ' A gentleman\'s Third.' : ''}`;
      try { game.ui.toast(msg, 7); } catch { /* */ }
      S.exam = null;
      if (!walkedOut && game.activity && game.activity.name === 'b6-exam') try { game.endActivity(); } catch { /* */ }
      return S.last;
    }
    function tickExam(dt) {
      const E = S.exam; if (!E || E.done) return;
      E.t += dt;
      if (E.showAt > 0) { E.showAt -= dt; if (E.showAt <= 0) E.show(); }
      const k = E.t > EXAM_SECS * 0.5 ? (E.t > EXAM_SECS * 0.75 ? 2 : 1) : 0;
      if (k > E.said && k > 0) { E.said = k; try { game.ui.toast(INVIGILATOR[k], 3); } catch { /* */ } }
      if (E.t >= EXAM_SECS) finish(false);
    }

    game.highStreet = {
      sights, ids: IDS, porterLine, ask, lookUp, room: ROOMID, queensList: QUEENS, plan: () => plan,
      queens: () => ({ found: [...S.found], paid: S.paid }),
      sit, answer, exam: () => S.exam, last: () => S.last, tickExam,
      enter() { const d = game.interiors.get(ROOMID); return d ? game.interiors.enterNow(ROOMID, d.doors[0]) : null; },
      stats() { const gs = K.lod.groups.filter((q) => /^hs:/.test(q.name)); return { levels: Object.fromEntries(gs.map((q) => [q.name, q.level])), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^hs:/.test(k)).map(([k, v]) => [k, v.tris])), exams: S.exams, asked: S.asked }; },
    };
    void corners;
    return { update(dt) { try { K.tick(me); void dt; } catch (e) { if (!S.err) { S.err = true; console.error('[high_street]', e); } } } };
  },
};
