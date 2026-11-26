// Lecture Theatre 1 runtime (owned by places/maths.js): sliding chalk boards, Dr Earl, the audience, sitting, notes,
// end-of-lecture "Understanding" and the problem sheet. The schedule runs on the shared real-time clock
// (game.time.now(); one 10-minute lecture per 12-minute slot, cycling 1–4: see lectureNow), so every client sees the
// same board at the same moment, and a player who walks in mid-lecture sees the boards already written.
import * as THREE from 'three';
import { createCharacter, randomLook, bakeCharacterGeometry, characterMaterial } from '../core/characters.js';
import { STANDIN_TRIS, trimBelow, compact, decimateTo, planLod } from './_maths_crowd.js';
import { LECTURES, lectureNow, frameAt, LECTURE_SEC, FRAME_A, FRAME_B } from './_maths_lectures.js';
import { BOARD, layoutFrame, clearBoard, drawGlyphs } from './_maths_chalk.js';
import { LT, rowFloor, theatreSeats, theatreGround } from './_maths_interior.js';

const NCOL = LT.cols.length, SLIDE = 0.1, WRITE0 = 0.12, WRITE1 = 0.92;
const hash = (a) => { let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

export function createLecture(game, ctx, earlLook) {
  const s = ctx.scene, FY = LT.frontY;
  const layouts = LECTURES.map((L) => L.frames.map((f) => layoutFrame(f.lines)));
  const R = { forced: null, n: -2, k: -2, inst: '', notes: 0, seated: 0, sitting: null, awarded: new Set(), sheetDone: new Set(), lastSay: '', phoneDone: '', endDone: '', subtitle: null };

  // ---------------------------------------------------------------- boards: NCOL columns × 2 sliding panels
  const panelGeo = new THREE.PlaneGeometry(LT.boardW, LT.boardH);
  const panels = [];
  for (let c = 0; c < NCOL; c++) for (let j = 0; j < 2; j++) {
    const cv = document.createElement('canvas'); cv.width = BOARD.W; cv.height = BOARD.H;
    const g = cv.getContext('2d'); clearBoard(g, c * 2 + j + 1);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    const grp = new THREE.Group(), mesh = new THREE.Mesh(panelGeo, m);
    grp.add(mesh);
    grp.position.set(LT.cols[c], 0, j === 0 ? 0.13 : 0.07);
    s.add(grp);
    panels.push({ c, j, g, t, grp, frame: -1, drawn: 0, dirty: false, lec: -1, seed: c * 2 + j + 1 });
  }
  const yLow = FY + LT.lowY + LT.boardH / 2, yHigh = FY + LT.highY + LT.boardH / 2;
  // column state scratch (allocation-free simulate)
  const colLower = new Int8Array(NCOL), colCount = new Int16Array(NCOL), colFrame = [new Int16Array(NCOL), new Int16Array(NCOL)];
  /** which frames sit on which panel after frames 0..kmax-1 have been written (kmax may be F) */
  function simulate(kmax) {
    colLower.fill(0); colCount.fill(0); colFrame[0].fill(-1); colFrame[1].fill(-1);
    for (let j = 0; j < kmax; j++) {
      const c = Math.floor(j / 2) % NCOL;
      if (colCount[c] > 0) colLower[c] = 1 - colLower[c];        // slide: lower goes up, the other comes down (wiped)
      colFrame[colLower[c]][c] = j; colCount[c]++;
    }
  }

  // projection screen (title slide) and the clock
  const scr = document.createElement('canvas'); scr.width = 512; scr.height = 288;
  const sg = scr.getContext('2d');
  const screenTex = new THREE.CanvasTexture(scr); screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.48), new THREE.MeshBasicMaterial({ map: screenTex, color: 0xdddddd }));
  screen.position.set(0, FY + 5.25, 0.08); s.add(screen);
  let screenFor = -9;
  function drawScreen(n) {
    if (screenFor === n) return; screenFor = n;
    sg.fillStyle = '#f7f7f4'; sg.fillRect(0, 0, 512, 288);
    sg.fillStyle = '#002147'; sg.fillRect(0, 0, 512, 46);
    sg.fillStyle = '#fff'; sg.font = 'bold 22px Arial, sans-serif'; sg.fillText('Oxford Mathematics', 16, 31);
    sg.fillStyle = '#1b1b1b'; sg.font = 'bold 30px Georgia, serif';
    if (n >= 0) {
      sg.fillText('M2: Analysis I', 24, 110); sg.font = '22px Georgia, serif';
      const t = LECTURES[n].title.replace('Analysis I — ', ''); sg.fillText(t.length > 40 ? t.slice(0, 40) + '…' : t, 24, 150);
      sg.font = '20px Arial, sans-serif'; sg.fillStyle = '#555'; sg.fillText('Dr Richard Earl  ·  Michaelmas Term', 24, 200);
    } else { sg.fillText('Lecture Theatre 1', 24, 120); sg.font = '20px Arial, sans-serif'; sg.fillStyle = '#555'; sg.fillText('Please take all litter with you.', 24, 170); }
    screenTex.needsUpdate = true;
  }
  drawScreen(-1);
  const clock = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#fafafa'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.lineWidth = 5; g.strokeStyle = '#222'; g.stroke();
    g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; g.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 6, 4, 12); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const grp = new THREE.Group(); grp.position.set(-7.6, FY + 5.6, 0.06);
    grp.add(new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ map: t })));
    const handMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const hh = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.22).translate(0, 0.1, 0.01), handMat);
    const mh = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.34).translate(0, 0.16, 0.012), handMat);
    grp.add(hh, mh); s.add(grp);
    return { hh, mh };
  })();

  // ---------------------------------------------------------------- seats (instanced) + the audience (one merged mesh)
  const seats = theatreSeats();
  {
    const g = new THREE.BoxGeometry(0.46, 0.06, 0.42).translate(0, 0.45, 0.02);
    const back = new THREE.BoxGeometry(0.46, 0.42, 0.05).translate(0, 0.68, -0.24);
    const leg = new THREE.BoxGeometry(0.05, 0.45, 0.05).translate(0, 0.22, -0.1);
    const geo = mergeGeos([g, back, leg]);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x2f4f78, roughness: 0.8 }), seats.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    seats.forEach((st, i) => { p.set(st.x, st.y, st.z); m.compose(p, q, one); im.setMatrixAt(i, m); });
    s.add(im);
  }
  // The audience: ONE merged mesh of seated people baked from real characters (core/characters.js
  // bakeCharacterGeometry: faces, hair, clothes), drawn with the shared character material. Three detail levels per
  // look (_maths_crowd.js): the baked body for the people nearest the camera, two vertex-clustered simplifications of
  // the same body further away. The levels are re-planned when the crowd changes or the camera moves ~1 m, under a
  // budget of STANDIN_TRIS (136) per person = what the old box-and-egg stand-ins cost, in one draw instead of two.
  const NVAR = 16, LEG_Y = 0.4;
  const variants = [];
  const AUD = { mesh: null, pos: null, nor: null, col: null, idx: null, n: 0, tris: 0, lod: [0, 0, 0], camX: 1e9, camY: 0, camZ: 1e9, rebuilds: 0 };
  function bakeVariants() {
    const FIG = ['casual', 'casual', 'casual', 'casual', 'casual', 'casual', 'smart', 'casual'];
    for (let v = 0; v < NVAR; v++) {
      const look = randomLook('maths-audience-' + v, { outfit: FIG[v % FIG.length] });
      look.prop = null; look.backpack = undefined;
      const g = bakeCharacterGeometry(look, v % 3 === 1 ? 'write' : 'sit');
      const pos = g.attributes.position.array, nor = g.attributes.normal.array, col = g.attributes.color.array, idx = g.index.array;
      const full = compact(pos, nor, col, idx);
      const cut = compact(pos, nor, col, trimBelow(pos, idx, LEG_Y));           // desks + seats hide the lower legs
      let top = 0; for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
      const fine = { y: top - 0.3, k: 0.55 };                                      // spend the far levels on the head
      const l1 = decimateTo(cut.pos, cut.col, cut.idx, 300, fine), l2 = decimateTo(cut.pos, cut.col, cut.idx, 84, fine);
      variants.push({ L: [cut, l1, l2], full, tris: [cut.idx.length / 3, l1.idx.length / 3, l2.idx.length / 3], fullTris: full.idx.length / 3 });
      g.dispose();
    }
    const MAX0 = 9, MAX1 = 40;
    const mv = (k) => Math.max(...variants.map((q) => q.L[k].pos.length / 3)), mi = (k) => Math.max(...variants.map((q) => q.L[k].idx.length));
    const fv = Math.max(...variants.map((q) => q.full.pos.length / 3)), fi = Math.max(...variants.map((q) => q.full.idx.length));
    const capV = MAX0 * Math.max(mv(0), fv) + MAX1 * mv(1) + seats.length * mv(2), capI = MAX0 * Math.max(mi(0), fi) + MAX1 * mi(1) + seats.length * mi(2);
    AUD.pos = new Float32Array(capV * 3); AUD.nor = new Float32Array(capV * 3); AUD.col = new Float32Array(capV * 3); AUD.idx = new Uint32Array(capI);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(AUD.pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(AUD.nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(AUD.col, 3)); geo.setIndex(new THREE.BufferAttribute(AUD.idx, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -2, 13), 16);   // the whole rake
    AUD.mesh = new THREE.Mesh(geo, characterMaterial); AUD.mesh.name = 'maths-audience'; AUD.mesh.matrixAutoUpdate = false;
    s.add(AUD.mesh);
    AUD.max0 = MAX0; AUD.max1 = MAX1;
  }
  const occupied = new Uint8Array(seats.length);
  const member = new Int32Array(seats.length), mVar = new Uint8Array(seats.length), mScale = new Float32Array(seats.length), mDist = new Float32Array(seats.length), mLevel = new Uint8Array(seats.length), mEdge = new Uint8Array(seats.length);
  const order = [];
  let crowdSig = '', nCrowd = 0;
  const tri3 = []; let tri3For = 0;
  /** write the merged audience for the current members and camera */
  function rebuildAudience() {
    if (!AUD.mesh) bakeVariants();
    const cam = game.camera.position;
    AUD.camX = cam.x; AUD.camY = cam.y; AUD.camZ = cam.z;
    order.length = 0;
    for (let k = 0; k < nCrowd; k++) { const st = seats[member[k]]; mDist[k] = Math.hypot(st.x - cam.x, st.y + 1.1 - cam.y, st.z - cam.z); order.push(k); }
    order.sort((p, q) => mDist[p] - mDist[q]);
    if (tri3For !== variants.length) { tri3.length = 0; for (const v of variants) tri3.push(v.tris); tri3For = variants.length; }
    // aisle-end seats within reach keep their lower legs (seen side-on from the aisle steps)
    // budget: what the stand-ins cost for this many people; a near-empty room still affords its nearest few real bodies
    // (FLOOR_TRIS, about four of them: far below the old full-house cost, and within +15 % of the room either way)
    AUD.budget = Math.max(nCrowd * STANDIN_TRIS, Math.min(nCrowd, 4) * 1100);
    AUD.tris = planLod(order, mVar, tri3, AUD.budget, mLevel, AUD.max0, AUD.max1, (k) => (mEdge[k] ? variants[mVar[k]].fullTris : variants[mVar[k]].tris[0]));
    const P = AUD.pos, N = AUD.nor, C = AUD.col, I = AUD.idx;
    let vo = 0, io = 0; AUD.lod[0] = AUD.lod[1] = AUD.lod[2] = 0;
    for (let k = 0; k < nCrowd; k++) {
      const st = seats[member[k]], V = variants[mVar[k]], lv = mLevel[k], G = lv === 0 && mEdge[k] ? V.full : V.L[lv], sc = mScale[k];
      const gp = G.pos, gn = G.nor, gc = G.col, gi = G.idx, nv = gp.length / 3;
      for (let v = 0, o = vo * 3; v < nv; v++, o += 3) {
        const q = v * 3;
        P[o] = st.x - gp[q] * sc; P[o + 1] = st.y + gp[q + 1] * sc; P[o + 2] = st.z - gp[q + 2] * sc;     // seats face the boards (-z): turned by pi
        N[o] = -gn[q]; N[o + 1] = gn[q + 1]; N[o + 2] = -gn[q + 2];
      }
      C.set(gc, vo * 3);
      for (let j = 0; j < gi.length; j++) I[io + j] = gi[j] + vo;
      vo += nv; io += gi.length; AUD.lod[lv]++;
    }
    const g = AUD.mesh.geometry;
    for (const a of [g.attributes.position, g.attributes.normal, g.attributes.color]) { a.clearUpdateRanges(); a.addUpdateRange(0, vo * 3); a.needsUpdate = true; }
    g.index.clearUpdateRanges(); g.index.addUpdateRange(0, io); g.index.needsUpdate = true;
    g.setDrawRange(0, io);
    AUD.n = nCrowd; AUD.tris = io / 3; AUD.rebuilds++;
  }
  function setCrowd(frac, salt, skip) {
    const sig = frac.toFixed(2) + '|' + salt + '|' + skip;
    const cam = game.camera.position, moved = Math.abs(cam.x - AUD.camX) + Math.abs(cam.y - AUD.camY) + Math.abs(cam.z - AUD.camZ) > 1.0;
    if (sig === crowdSig) { if (moved && nCrowd) rebuildAudience(); return; }
    crowdSig = sig;
    let n = 0; occupied.fill(0);
    seats.forEach((st, i) => {
      if (realSeat.has(i) || i === skip) return;
      // fuller towards the middle rows and blocks; deterministic per lecture
      const bias = (st.block === 1 ? 0.12 : 0) + (st.row > 1 && st.row < 11 ? 0.08 : -0.1);
      if (hash(i * 7919 + salt) > frac + bias) return;
      member[n] = i; mVar[n] = Math.floor(hash(i * 31 + salt * 3) * NVAR) % NVAR; mScale[n] = 0.96 + hash(i * 17 + salt) * 0.07;
      mEdge[n] = st.i === 0 || st.i === st.n - 1 ? 1 : 0;
      occupied[i] = 1; n++;
    });
    nCrowd = n;
    rebuildAudience();
  }
  const seatIdx = (row, block, i) => seats.findIndex((q) => q.row === row && q.block === block && q.i === i);

  // ---------------------------------------------------------------- people: Dr Earl + a few animated students
  const earl = createCharacter({ ...(earlLook || randomLook('maths-don', { outfit: 'tweed' })), prop: null });
  earl.setLabel('Dr Earl'); s.add(earl.group); earl.group.visible = false;
  const E = { x: 0, z: 1.2, tx: 0, speed: 0 };
  const realDefs = [[4, 1, 2], [5, 1, 7], [6, 0, 6], [7, 2, 1]];
  const realSeat = new Set(realDefs.map(([r, b, i]) => seatIdx(r, b, i)));
  const reals = realDefs.map(([r, b, i], k) => {
    const st = seats[seatIdx(r, b, i)];
    const ch = createCharacter(randomLook('maths-student-' + k, { outfit: 'casual' }));
    ch.group.position.set(st.x, st.y, st.z); ch.group.rotation.y = Math.PI; ch.setPose('write'); s.add(ch.group);
    return { ch, st };
  });
  const lateSeat = seats[seatIdx(9, 2, 0)];
  realSeat.add(seatIdx(9, 2, 0));
  const late = { ch: createCharacter({ ...randomLook('maths-latecomer', { outfit: 'casual' }), backpack: 0x222222 }), state: 'out' };
  s.add(late.ch.group); late.ch.group.visible = false;
  const lateLines = ['Sorry…', 'Sorry — bike chain.', 'Sorry, sorry.'];

  // subtitles (only while the local player is in the theatre)
  function subtitle(text) {
    if (typeof document === 'undefined') return;
    if (!R.subtitle) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:50%;bottom:9%;transform:translateX(-50%);max-width:70%;padding:6px 14px;background:rgba(0,0,0,0.6);color:#fff;font:16px/1.35 Georgia,serif;border-radius:4px;text-align:center;pointer-events:none;z-index:30;display:none';
      document.body.appendChild(d); R.subtitle = d;
    }
    R.subtitle.style.display = text ? 'block' : 'none';
    if (text) R.subtitle.innerHTML = '<b>Dr Earl:</b> ' + text.replace(/[<>&]/g, '');
  }

  // ---------------------------------------------------------------- state from the shared clock
  function state() {
    if (R.forced) {
      const t = R.forced.t + (R.forced.hold ? 0 : (performance.now() - R.forced.at) / 1000 / LECTURE_SEC);
      if (t > 1.2) R.forced = null; else return { n: R.forced.n, t, inst: 'forced' + R.forced.id };
    }
    const a = lectureNow(game.time.now());
    return { n: a.n, t: a.t, inst: 'slot' + a.slot };
  }

  // ---------------------------------------------------------------- per-frame
  let uploadT = 0, sitN = 0;
  function update(dt) {
    const st = state(), n = st.n, t = st.t;
    const lec = n >= 0 ? LECTURES[n] : null, F = lec ? lec.frames.length : 0;
    let k = -1, p = 0;
    if (lec) { const fa = frameAt(lec, Math.min(t, 0.9999)); k = fa.k; p = fa.p; if (t >= 1) { k = F; p = 1; } }
    const live = lec && t < FRAME_B && t >= 0.0;
    R.n = n; R.k = k; R.inst = st.inst;
    drawScreen(n);

    // boards: frames 0..k-1 complete, frame k partially written
    const kmax = lec ? Math.min(F, k + 1) : 0;
    simulate(kmax);
    let slideC = -1, slideU = 1;
    if (lec && k >= 0 && k < F) {
      const c = Math.floor(k / 2) % NCOL;
      if (colCount[c] > 1 && p < SLIDE) { slideC = c; slideU = p / SLIDE; }
    }
    for (const P of panels) {
      const frame = colFrame[P.j][P.c], lower = colLower[P.c] === P.j;
      let y = lower ? yLow : yHigh;
      if (P.c === slideC) { const from = lower ? yHigh : yLow, u = slideU * slideU * (3 - 2 * slideU); y = from + (y - from) * u; }
      P.grp.position.y = y;
      // contents
      let want = 0;
      if (frame >= 0) {
        const glyphs = layouts[n][frame].glyphs;
        if (frame < k) want = glyphs.length;
        else { const w = (p - WRITE0) / (WRITE1 - WRITE0); want = Math.max(0, Math.min(glyphs.length, Math.floor(glyphs.length * w))); if (P.c === slideC) want = 0; }
      }
      if (P.frame !== frame || P.lec !== n || want < P.drawn) {
        clearBoard(P.g, P.seed + (frame + 1) * 13); P.frame = frame; P.lec = n; P.drawn = 0; P.dirty = true;
      }
      if (frame >= 0 && want > P.drawn) { drawGlyphs(P.g, layouts[n][frame].glyphs, P.drawn, want, frame * 7 + n); P.drawn = want; P.dirty = true; }
    }
    uploadT -= dt;
    if (uploadT <= 0) { uploadT = 0.12; for (const P of panels) if (P.dirty) { P.t.needsUpdate = true; P.dirty = false; } }

    // clock (game time)
    const h = game.time.hour;
    clock.mh.rotation.z = -((h % 1) * Math.PI * 2); clock.hh.rotation.z = -(((h % 12) / 12) * Math.PI * 2);

    // Dr Earl
    const earlOn = lec && t < 1.03;
    earl.group.visible = !!earlOn;
    if (earlOn) {
      if (k < 0) E.tx = -1.0;
      else if (k >= F) E.tx = 0;
      else E.tx = LT.cols[Math.floor(k / 2) % NCOL] + (p < SLIDE ? 0.9 : 1.1);
      const d = E.tx - E.x, sp = Math.min(1.3, Math.abs(d) * 2);
      E.speed = Math.abs(d) > 0.05 ? sp : 0; E.x += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      const walking = E.speed > 0.1;
      earl.setPose(walking || k < 0 || k >= F ? 'stand' : 'lecture');
      earl.group.position.set(E.x, FY, E.z); earl.group.rotation.y = walking ? (d > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
      earl.update(dt, E.speed);
      const say = k < 0 ? (t < 0.005 ? '' : "Right, shall we make a start?") : k >= F ? (t < 1 ? "That's all for today. The problem sheet is on the bench." : '') : lec.frames[k].say;
      if (say && say !== R.lastSay) { R.lastSay = say; earl.say(say, 14); if (game.player.place === ctx.id) { subtitle(say); game.voice?.say('earl', say, { interrupt: true }); } }
      if (!say && R.lastSay) { R.lastSay = ''; subtitle(null); }
    } else if (R.lastSay) { R.lastSay = ''; subtitle(null); }

    // audience: arrives for the lecture, drifts away in the break; a few revisers otherwise
    const salt = n >= 0 ? n * 101 + (st.inst.length ? st.inst.charCodeAt(0) : 0) : 7;
    let frac = 0.04;
    if (lec && t < 1) frac = t < FRAME_A ? 0.3 + (t / FRAME_A) * 0.32 : 0.62;
    else if (lec && t < 1.15) frac = 0.62 * (1 - (t - 1) / 0.15) + 0.04;
    else if (lec && t >= 1.15) frac = 0.15;    // early arrivals for the next one
    setCrowd(Math.round(frac * 20) / 20, salt, R.sitting ? R.sitting.idx : -1);
    const realsOn = lec ? t < 1.08 : true;
    for (const r of reals) { r.ch.group.visible = realsOn; if (realsOn) r.ch.update(dt, 0); }

    // latecomer: creeps in from the back door and down the aisle steps
    if (live && t > 0.05 && t < 0.075) {
      const u = (t - 0.05) / 0.025, L = late.ch, a = 3.35;
      const path = [[0, LT.back - 0.6], [a, LT.back - 0.6], [a, lateSeat.z], [lateSeat.x, lateSeat.z]];
      const segs = [3.35, LT.back - 0.6 - lateSeat.z, lateSeat.x - a], tot = segs[0] + segs[1] + segs[2];
      let d = u * tot, i = 0; while (i < 2 && d > segs[i]) { d -= segs[i]; i++; }
      const A = path[i], Bp = path[i + 1], f = Math.min(1, d / segs[i]);
      const x = A[0] + (Bp[0] - A[0]) * f, z = A[1] + (Bp[1] - A[1]) * f;
      L.group.visible = true;
      if (u < 0.97) { L.setPose('stand'); L.group.position.set(x, theatreGround(x, z), z); L.group.rotation.y = Math.atan2(Bp[0] - A[0], Bp[1] - A[1]); L.update(dt, 1.1); if (late.state !== 'walk') { late.state = 'walk'; L.say(lateLines[Math.floor(hash(n + 5) * 3)], 3); } }
      else { L.setPose('write'); L.group.position.set(lateSeat.x, lateSeat.y, lateSeat.z); L.group.rotation.y = Math.PI; L.update(dt, 0); late.state = 'seated'; }
    } else if (lec && t >= 0.075 && t < 1.08) { const L = late.ch; L.group.visible = true; L.setPose('write'); L.group.position.set(lateSeat.x, lateSeat.y, lateSeat.z); L.group.rotation.y = Math.PI; L.update(dt, 0); }
    else late.ch.group.visible = false;

    // somebody's phone goes off
    if (live && t > 0.55 && t < 0.6 && R.phoneDone !== st.inst) {
      R.phoneDone = st.inst;
      const who = reals[Math.floor(hash(n + 11) * reals.length)];
      who.ch.setPose('phone', { duration: 2.6 });
      if (game.player.place === ctx.id) {
        ringtone();
        setTimeout(() => { earl.say("Someone's phone would like to join in. Don't worry — we'll wait.", 4); subtitle("Someone's phone would like to join in. Don't worry — we'll wait."); }, 1500);
      }
    }
    // end of the lecture: applause-free shuffling, Understanding for attentive note-takers
    if (lec && t >= FRAME_B && R.endDone !== st.inst) {
      R.endDone = st.inst;
      if (game.player.place === ctx.id) {
        if (t < 1.02) shuffle();
        if (R.notesInst === st.inst) award(n, st.inst);
      }
    }
    // seated: accumulate attendance
    if (R.sitting && live && t > FRAME_A) R.seated += dt;
    if (R.sitting && R.ui) R.ui.tick(dt, live && k >= 0 && k < F);
  }

  function award(n, inst) {
    const need = (FRAME_B - FRAME_A) * LECTURE_SEC;
    const att = R.notesInst === inst ? R.seated / need : 0;
    if (R.awarded.has(inst)) return;
    if (R.notes >= 35 && att >= 0.3) {
      R.awarded.add(inst);
      const f = game.state.flags || (game.state.flags = {});
      f.mathsUnderstanding = (f.mathsUnderstanding || 0) + 1;
      f['maths_understood_' + (n + 1)] = true;
      try { game.save(); } catch (e) { /* ignore */ }
      game.ui.toast(`You now understand ${LECTURES[n].topic} (+1 Understanding)`, 6);
    } else game.ui.toast(R.notes < 35 ? 'Your notes are a bit thin. The problem sheet might help.' : 'You missed too much of it to follow. Next time!', 5);
  }

  function ringtone() {
    const A = game.audio; if (!A || !A.ctx) return;
    for (let i = 0; i < 6; i++) { A.tone(1318, 0.09, { type: 'square', gain: 0.05, when: i * 0.24 }); A.tone(1568, 0.09, { type: 'square', gain: 0.05, when: i * 0.24 + 0.1 }); }
  }
  function shuffle() {
    const A = game.audio; if (!A || !A.ctx) return;
    for (let i = 0; i < 10; i++) A.noise(0.35 + (i % 3) * 0.2, { gain: 0.05, freq: 500 + i * 40, q: 0.6, type: 'lowpass', when: i * 0.22 });
  }
  function scribble() { const A = game.audio; if (A && A.ctx) A.noise(0.12, { gain: 0.04, freq: 3000, q: 2, type: 'bandpass' }); }

  // ---------------------------------------------------------------- sitting + notes
  function freeSeatNear(row, x) {
    let best = -1, bd = 1e9;
    seats.forEach((q, i) => { if (q.row !== row || occupied[i] || realSeat.has(i)) return; const d = Math.abs(q.x - x); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function sit(idx) {
    const st = seats[idx]; if (!st || game.activity) return false;
    const P = game.player;
    R.sitting = { idx, yaw: 0, pitch: 0 };
    crowdSig = '';
    P.teleport(st.x, st.z, Math.PI); P.pose = 'write'; P.character.group.visible = false;   // first-person while seated
    const cur = state();
    if (R.notesInst !== cur.inst) { R.notesInst = cur.inst; R.notes = 0; R.seated = 0; }
    const ov = game.ui.openOverlay({ dim: false });
    ov.style.pointerEvents = 'none';
    ov.innerHTML = `<div style="position:absolute;left:50%;bottom:20%;transform:translateX(-50%);width:360px;font:13px Arial,sans-serif;color:#fff;text-shadow:0 1px 2px #000">
      <div>Notes <span data-n>0</span>%</div>
      <div style="height:8px;background:rgba(255,255,255,0.2);margin:3px 0 8px"><div data-m style="height:100%;width:0;background:#f2d36b"></div></div>
      <div style="position:relative;height:16px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.5)">
        <div data-z style="position:absolute;top:0;bottom:0;width:16%;background:rgba(90,200,120,0.6)"></div>
        <div data-c style="position:absolute;top:-3px;bottom:-3px;width:3px;background:#fff"></div></div>
      <div data-h style="margin-top:6px;opacity:0.9">[N] take notes when the marker is in the green · mouse to look · Esc to stand up</div></div>`;
    const q = (a) => ov.querySelector(`[data-${a}]`), elN = q('n'), elM = q('m'), elZ = q('z'), elC = q('c'), elH = q('h');
    let ph = 0, zone = 0.5, flash = 0;
    elZ.style.left = (zone - 0.08) * 100 + '%';
    R.ui = {
      tick(dt, writing) {
        ph += dt * 2.3; const pos = (Math.sin(ph) + 1) / 2; elC.style.left = pos * 100 + '%'; R.ui.pos = pos; R.ui.writing = writing;
        if (flash > 0) { flash -= dt; if (flash <= 0) elZ.style.background = 'rgba(90,200,120,0.6)'; }
        elH.textContent = writing ? '[N] take notes when the marker is in the green · mouse to look · Esc to stand up'
          : (R.n >= 0 && R.k >= LECTURES[R.n].frames.length ? 'The lecture has finished; the next starts shortly. Esc to stand up.' : 'Dr Earl is about to begin. Esc to stand up.');
      },
      hit() {
        if (!R.ui.writing) return;
        const ok = Math.abs(R.ui.pos - zone) < 0.08;
        R.notes = Math.max(0, Math.min(100, R.notes + (ok ? 7 : -2)));
        elZ.style.background = ok ? 'rgba(140,255,160,0.95)' : 'rgba(255,90,90,0.8)'; flash = 0.25;
        if (ok) { zone = 0.12 + hash(++sitN * 13 + 7) * 0.76; elZ.style.left = (zone - 0.08) * 100 + '%'; scribble(); }
        elN.textContent = Math.round(R.notes); elM.style.width = R.notes + '%';
      },
      pos: 0, writing: false,
    };
    elN.textContent = Math.round(R.notes); elM.style.width = R.notes + '%';
    game.beginActivity({
      name: 'maths-sit', pointer: 'locked',
      onKey(code) { if (code === 'KeyN') R.ui && R.ui.hit(); },
      camera(dt, cam) {
        const inp = game.input, S = R.sitting; if (!S) return;
        if (inp.locked) { S.yaw = Math.max(-1.2, Math.min(1.2, S.yaw - inp.mouseDX * 0.0024)); S.pitch = Math.max(-0.6, Math.min(0.5, S.pitch - inp.mouseDY * 0.0022)); }
        const ex = st.x, ey = st.y + 1.32, ez = st.z - 0.02;
        // base direction: towards the middle of the boards
        const bx = 0 - ex, by = FY + 2.3 - ey, bz = 0 - ez, yaw0 = Math.atan2(bx, bz), pitch0 = Math.atan2(by, Math.hypot(bx, bz));
        const yw = yaw0 + S.yaw, pt = pitch0 + S.pitch;
        cam.fov = 46; cam.updateProjectionMatrix();
        cam.position.set(ex, ey, ez); cam.lookAt(ex + Math.sin(yw) * Math.cos(pt), ey + Math.sin(pt), ez + Math.cos(yw) * Math.cos(pt));
      },
      onEnd() {
        R.sitting = null; R.ui = null; crowdSig = '';
        game.player.pose = 'stand'; game.player.character.group.visible = true; game.camera.fov = 60; game.camera.updateProjectionMatrix();
        const a = st.x < 0 ? (st.x < -3.35 ? -8.98 : -3.35) : (st.x > 3.35 ? 8.98 : 3.35);
        const ax = Math.abs(st.x - a) < 3.5 ? a : (st.block === 1 ? (st.x < 0 ? -3.35 : 3.35) : (st.x < 0 ? -8.98 : 8.98));
        game.player.teleport(ax, st.z, Math.PI);
      },
    });
    return true;
  }

  // ---------------------------------------------------------------- problem sheet
  function sheet(n, inst) {
    const L = LECTURES[n]; if (!L) return;
    game.beginActivity({ name: 'maths-sheet', pointer: 'free' });
    const ov = game.ui.openOverlay();
    let i = 0, correct = 0;
    const show = () => {
      if (i >= L.quiz.length) {
        const pay = correct; if (pay) game.pay(pay);
        R.sheetDone.add(inst);
        const f = game.state.flags || (game.state.flags = {}); f['maths_sheet_' + (n + 1)] = Math.max(f['maths_sheet_' + (n + 1)] || 0, correct);
        try { game.save(); } catch (e) { /* ignore */ }
        ov.innerHTML = `<div style="max-width:520px;margin:12% auto;background:#fbfaf6;color:#222;padding:22px 26px;font:16px Georgia,serif;border-radius:4px">
          <h3 style="margin:0 0 10px">Problem sheet ${n + 1}: ${correct}/3</h3><p>${correct === 3 ? 'Full marks. Dr Earl will be pleased.' : correct ? 'Not bad — worth another look at the boards.' : 'Hmm. Perhaps re-read your notes.'}</p>
          <p>${pay ? `+£${pay}.00 (tutorial-fund bursary)` : ''}</p><p style="opacity:0.7">Esc to close</p></div>`;
        return;
      }
      const q = L.quiz[i];
      ov.innerHTML = `<div style="max-width:560px;margin:10% auto;background:#fbfaf6;color:#222;padding:22px 26px;font:17px Georgia,serif;border-radius:4px">
        <div style="font:13px Arial;opacity:0.7">Problem sheet — ${L.title.replace('Analysis I — ', '')} · question ${i + 1} of 3</div>
        <p style="margin:12px 0 16px">${q.q}</p>${q.options.map((o, j) => `<button data-a="${j}" style="display:block;width:100%;text-align:left;margin:6px 0;padding:8px 12px;font:16px Georgia,serif;cursor:pointer">${String.fromCharCode(97 + j)})  ${o}</button>`).join('')}</div>`;
      ov.querySelectorAll('button').forEach((b) => { b.onclick = () => { if (+b.dataset.a === q.answer) correct++; i++; show(); }; });
    };
    show();
  }

  return {
    update, sit, sheet, state, freeSeatNear, seats, R, occupied,
    startLecture(n, t = 0, hold = false) { R.forced = n === null || n === undefined ? null : { n: Math.max(0, Math.min(3, n | 0)), t, hold, at: performance.now(), id: Math.random().toString(36).slice(2, 7) }; crowdSig = ''; return state(); },
    lastLecture() { const st = state(); if (st.n >= 0 && st.t >= FRAME_B) return st; return null; },
    onExit() { subtitle(null); },
    stats() { return { panels: panels.length, audience: nCrowd, audienceTris: AUD.tris, audienceBudget: AUD.budget || 0, standinTris: nCrowd * STANDIN_TRIS, audienceDraws: AUD.mesh ? 1 : 0, audienceLod: AUD.lod.slice(), audienceVariants: variants.map((v) => [v.fullTris, ...v.tris]), seats: seats.length, notes: R.notes, seated: R.seated, n: R.n, k: R.k }; },
  };
}

/** merge geometries (non-indexed), optional per-geometry vertex colours */
function mergeGeos(geos, colors) {
  const pos = [], nor = [], uv = [], col = [];
  geos.forEach((g0, gi) => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv ? g.attributes.uv.array : null;
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) { uv.push(U ? U[i * 2] : 0, U ? U[i * 2 + 1] : 0); if (colors) { const c = new THREE.Color(colors[gi]); col.push(c.r, c.g, c.b); } }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colors) out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
export { rowFloor };
