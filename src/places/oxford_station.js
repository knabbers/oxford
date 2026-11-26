// Oxford railway station, c. 2013 — see docs/research/city_centre_west.md.
//   preMap    the generic station outlines (the building with platform 1, platform 2's building and canopies, the cycle
//             shed) are skipped; the railway (track bed + platforms) is fenced off from the street and its mapped
//             platform footways closed to the ambient walkers
//   install   the 1990 building (brick, glass, a pitched glazed roof), two raised platforms with canopies, four roads of
//             track, the covered footbridge and its stairs, the forecourt's cycle racks packed with bikes, a covered way
//             to the north where the line comes in (_cw_station.js) — in the shared one-draw LOD (_cw_kit.js); two trains
//             (_cw_train.js) that run in, stand and run out on the shared clock (one draw each, near the station only).
//             Buy a ticket at the forecourt doors and go through the barriers: the platforms are a place of their own
//             that renders the real world (raised floor, the footbridge's stairs, you cannot step onto the tracks).
// No operator names, liveries or logos. No Math.random, no network.
// Test hooks: game.station = { sights, stats(), debugPlatforms(on), trainAt }      tools/smoke_citywest.mjs
import * as THREE from 'three';
import { Collider } from '../core/collision.js';
import { shared, addLevels, farCopy, cwSigns, signsMesh, signsTick, signQuad, Batch, RB, geoOf, TAU } from './_cw_kit.js';
import * as ST from './_cw_station.js';
import * as TR from './_cw_train.js';
import { HOUR_MS } from '../core/time.js';

export const PLACE = 'cw_station', FARE = 3.7;
const RAIL = () => { const P = [[-160, -12.2], [-160, 10.4], [-104, 10.4], [-104, ST.PLAT.p1[1]], [120, ST.PLAT.p1[1]], [120, ST.PLAT.p2[0]], [-104, ST.PLAT.p2[0]], [-104, -12.2]]; return P.map(([s, t]) => ST.L(s, t)); };

export default {
  id: 'oxford_station',
  preMap(game) {
    try {
      const ov = game.overrides, map = game.map, C = game.worldCollider;
      for (const id of ST.SKIP) ov.skip.add(id);
      const rail = RAIL(); C.addPolygon(rail);
      const b = ST.BLD; C.addPolygon([[b.s0, b.t0], [b.s0, b.t1], [b.s1, b.t1], [b.s1, b.t0]].map(([s, t]) => ST.L(s, t)));
      for (const r of map.roads) { if (!r.pts || !/footway|steps|path|corridor/.test(r.kind)) continue; if (r.pts.some((p) => inPoly(p, rail))) r.access = 'no'; }
      // the mapped station footbridge is a bridge deck area: not drawn (ours is a covered bridge over the line)
      ov.skip.add('w163814523'); ov.skip.add('w42782327'); ov.skip.add('w42782194'); ov.skip.add('w42782328');
      // photo comparison item 18 ("station"): the forecourt inside the loop of service roads was the world's default
      // garden grass; in 2008-13 it was tarmac — bus stands and the taxi rank. Outline from the mapped service roads
      // (a GUESS at its exact edges).
      if (!map.areas.some((a) => a.id === 'stn-forecourt')) map.areas.push({ id: 'stn-forecourt', kind: 'paved', surface: 'asphalt', name: 'Station forecourt', poly: [[-669, 133], [-641, 129.5], [-635, 160], [-626, 199], [-622, 213], [-641, 215], [-664, 217], [-662, 190], [-668, 152]] });
    } catch (e) { console.error('[oxford_station] preMap', e); }
  },
  install(game) {
    const W = game.world, S = shared(game), st = { err: false, on: false, upper: false, last: [0, 0], said: {}, sound: 0, debugFree: false };
    S.site('station', [-760, -620, -50, 250]);
    try { W.clearArea(RAIL(), { trees: true, furniture: true, lamps: true }); } catch { /* */ }
    const g = ST.build(S.P);
    addLevels(S, 'station', g.near, farCopy(g.near, 0.9), g.far, [75, 230, 650], 48);
    addLevels(S, 'stationbikes', g.bikes, null, null, [50, 0, 0], 24);
    // boards: station name, platform numbers, departures, the entrance, the taxi rank, the cycle racks
    const sg = cwSigns(W), Bs = new Batch(), Y = ST.PLAT.y;
    const board = (name, s, t, along, face, w, y0, y1) => {
      // along: the board runs along the track (true) or across it; face: +1/-1 which way it faces
      const c = ST.L(s, t), n = along ? ST.N : ST.U, nx = n[0] * face, nz = n[1] * face, ux = nz, uz = -nx; /* left -> right seen from the front */
      signQuad(Bs, sg.uv(name), c[0] - ux * w / 2, c[1] - uz * w / 2, c[0] + ux * w / 2, c[1] + uz * w / 2, y0, y1, nx, nz, 0.03);
    };
    // name boards hang over the platforms: lettered on both faces (the material is double-sided, so each face needs its own quad)
    for (const s of [-60, 20, 70]) for (const f of [1, -1]) { board('oxford', s, ST.PLAT.p2[1] - 2.2 + f * 0.04, true, f, 2.2, Y + 2.6, Y + 2.9); board('oxford', s, ST.PLAT.p1[0] + 2.2 + f * 0.04, true, f, 2.2, Y + 2.8, Y + 3.1); }
    board('p2', 14, -13.0, false, 1, 0.8, Y + 2.7, Y + 3.5); board('p1', 14, 11.1, false, 1, 0.8, Y + 2.7, Y + 3.5);
    // hanging platform numbers down both platforms (both faces), on rods from the canopy
    const HANG = [[-24, -16.3, 'p2', Y + 3.9], [44, -16.3, 'p2', Y + 3.9], [78, -16.3, 'p2', Y + 3.9], [-20, 12.2, 'p1', Y + 4.1], [46, 12.2, 'p1', Y + 4.1], [80, 12.2, 'p1', Y + 4.1]];
    for (const [s, t, name, yc] of HANG) for (const f of [1, -1]) board(name, s + f * 0.03, t, false, f, 0.7, yc - 1.25, yc - 0.55);
    board('mindgap', 50, ST.PLAT.p1[0] + 3.5, true, -1, 1.2, Y + 2.0, Y + 2.3);
    board('station', ST.ENTRANCE_S, ST.BLD.t1 + 5.15, true, 1, 5.0, ST.BLD.h - 1.05, ST.BLD.h - 0.45);
    board('tickets', ST.ENTRANCE_S, ST.BLD.t1 + 0.12, true, 1, 2.0, 2.7, 3.1);
    board('bikes', 96, 20.5, false, -1, 1.6, 2.2, 2.6);
    { const [x, z] = [-628.6, 177.5]; signQuad(Bs, sg.uv('taxi'), x + 0.8, z, x - 0.8, z, 2.0, 2.4, 0, -1, 0.02); signQuad(Bs, sg.uv('taxi'), x - 0.8, z + 0.02, x + 0.8, z + 0.02, 2.0, 2.4, 0, 1, 0.02); game.worldCollider.addCircle(x, z, 0.2); }
    const signs = signsMesh(Bs, W, 'station'); if (signs) W.addStatic(signs);
    // ---- the departure boards and the platform clocks: one canvas redrawn each game minute (times follow the shared
    // clock: the next trains of the timetable, invented times, real destinations), one unlit draw near the station only
    const DB = (() => {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const mat = new THREE.MeshBasicMaterial({ map: tex, name: 'cw-station-boards' });
      const B = new Batch(), R = new RB();
      const quad = (s, t, yc, w, h, face, uv) => { const c = ST.L(s, t), nx = ST.U[0] * face, nz = ST.U[1] * face, ux = nz, uz = -nx; B.card('b', [c[0] - ux * w / 2 + nx * 0.06, yc - h / 2, c[1] - uz * w / 2 + nz * 0.06], [c[0] + ux * w / 2 + nx * 0.06, yc - h / 2, c[1] + uz * w / 2 + nz * 0.06], [c[0] + ux * w / 2 + nx * 0.06, yc + h / 2, c[1] + uz * w / 2 + nz * 0.06], [c[0] - ux * w / 2 + nx * 0.06, yc + h / 2, c[1] - uz * w / 2 + nz * 0.06], uv); };
      const UVB = [0, 0.5, 0.5, 1], UVB2 = [0.5, 0.5, 1, 1], UVC = [0, 0, 0.25, 0.5];
      const SPOTS = [[30, 12.2, Y + 2.9, 'board'], [24, -16.3, Y + 2.75, 'board'], [62, 12.2, Y + 3.15, 'clock'], [60, -16.3, Y + 3.0, 'clock']];
      R.push(new THREE.Matrix4());
      for (const [s, t, yc, kind] of SPOTS) {
        const c = ST.L(s, t), q = Math.atan2(-ST.N[1], ST.N[0]);
        if (kind === 'board') { quad(s, t, yc, 2.4, 0.9, 1, UVB); quad(s, t, yc, 2.4, 0.9, -1, UVB2); R.box('cwBlack', c[0], yc, c[1], 2.55, 1.0, 0.1, q); for (const e of [-1, 1]) R.box('cwSteel', c[0] + ST.N[0] * e * 0.9, yc + 0.5 + 0.35, c[1] + ST.N[1] * e * 0.9, 0.04, 0.7, 0.04, q); }
        else { quad(s, t, yc, 0.7, 0.7, 1, UVC); quad(s, t, yc, 0.7, 0.7, -1, UVC); R.box('cwBlack', c[0], yc, c[1], 0.8, 0.8, 0.1, q); R.box('cwSteel', c[0], yc + 0.4 + 0.3, c[1], 0.05, 0.6, 0.05, q); }
      }
      for (const [s, t, , yc] of HANG) { const c = ST.L(s, t); for (const e of [-1, 1]) R.box('cwSteel', c[0] + ST.N[0] * e * 0.3, yc - 0.27, c[1] + ST.N[1] * e * 0.3, 0.03, 0.56, 0.03); }
      R.pop();
      addLevels(S, 'stationfix', geoOf(R, S.P), null, null, [70, 0, 0], 48);
      const tmp = new THREE.Group(), meshes = B.build({ b: mat }, tmp, { noShadow: true }), mesh = meshes[0];
      mesh.name = 'cw:station-boards'; mesh.castShadow = false; mesh.visible = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      game.worldScene.add(mesh);
      return { cv, tex, mesh, last: '' };
    })();
    /** pure-ish: the next n departures [{h (game hour), dest, plat}] after game time `now` (ms) */
    const departures = (now, hourNow, n = 4) => {
      const out = [];
      for (const [k, T] of TR.TRAINS.entries()) {
        const base = Math.floor((now - T.offset) / TR.CYCLE);
        for (let j = 0; j < 4; j++) {
          const nn = base + j, dep = T.offset + nn * TR.CYCLE + TR.T_IN + TR.T_DWELL;
          if (dep < now - 20000) continue;
          out.push({ ms: dep, h: hourNow + (dep - now) / HOUR_MS, dest: T.dest[((nn % T.dest.length) + T.dest.length) % T.dest.length], plat: T.platform, k });
        }
      }
      return out.sort((a, b) => a.ms - b.ms).slice(0, n);
    };
    function drawBoards(now, hourNow) {
      const g = DB.cv.getContext('2d'), list = departures(now, hourNow, 4);
      const key = Math.floor(hourNow * 60) + '|' + list.map((d) => d.ms).join(',');
      if (key === DB.last) return; DB.last = key;
      for (const [x0, mine] of [[0, 1], [512, 2]]) {
        g.fillStyle = '#060606'; g.fillRect(x0, 0, 512, 256);
        g.fillStyle = '#f0a020'; g.font = 'bold 30px Arial, Helvetica, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillText('Departures', x0 + 16, 26); g.textAlign = 'right'; g.fillText(TR.hhmm(hourNow), x0 + 496, 26);
        g.fillStyle = '#5a3a08'; g.fillRect(x0 + 10, 46, 492, 2);
        g.font = 'bold 26px Arial, Helvetica, sans-serif';
        list.forEach((d, i) => {
          const y = 76 + i * 46, now2 = d.ms <= now + 1000 && d.ms > now - 20000;
          g.fillStyle = d.plat === mine ? '#ffb830' : '#d89018'; g.textAlign = 'left';
          g.fillText(TR.hhmm(d.h), x0 + 14, y); g.fillText(d.dest.length > 17 ? d.dest.slice(0, 16) + '.' : d.dest, x0 + 104, y);
          g.textAlign = 'right'; g.fillText(String(d.plat), x0 + 392, y); g.fillText(now2 ? 'Boarding' : i === 2 && (Math.floor(d.ms / TR.CYCLE) % 5 === 3) ? 'Exp ' + TR.hhmm(d.h + 0.08) : 'On time', x0 + 500, y);
        });
      }
      // the clock face
      const cx = 128, cy = 384, r = 120;
      g.fillStyle = '#f4f2ea'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.lineWidth = 8; g.strokeStyle = '#222'; g.stroke();
      g.fillStyle = '#222'; for (let k = 0; k < 60; k++) { g.save(); g.translate(cx, cy); g.rotate((k / 60) * TAU); g.fillRect(k % 5 ? -1.5 : -4, -r + 8, k % 5 ? 3 : 8, k % 5 ? 8 : 22); g.restore(); }
      const mins = (((hourNow % 24) + 24) % 24) * 60, ha = (mins / 720) * TAU, ma = ((mins % 60) / 60) * TAU;
      const hand = (a, len, w) => { g.save(); g.translate(cx, cy); g.rotate(a); g.fillRect(-w / 2, -len, w, len + 10); g.restore(); };
      hand(ha, r * 0.55, 10); hand(ma, r * 0.85, 6); g.beginPath(); g.arc(cx, cy, 7, 0, TAU); g.fill();
      DB.tex.needsUpdate = true;
    }
    // a post for the taxi sign
    // the trains: one mesh each (the model shared), moved along their road on the shared clock
    const tg = TR.trainGeometry(S.P);
    const trains = TR.TRAINS.map((T, k) => {
      const m = new THREE.Mesh(tg.geo, S.P.atlas); m.name = 'cw:train:' + T.id; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.visible = false; m.matrixAutoUpdate = false;
      game.worldScene.add(m);
      return { T, k, m, last: null };
    });
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ST.headingS), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
    const centre = ST.L(0, 0);
    // the platforms' place
    const cols = ST.colliders(Collider);
    const ground = (x, z) => ST.floorAt(x, z, st.upper);
    const spawn = ST.L(ST.ENTRANCE_S, ST.PLAT.p1[1] - 1.3), barrierFacing = Math.atan2(ST.N[0], ST.N[1]);
    const doorOut = ST.L(ST.ENTRANCE_S, ST.BLD.t1 + 2.4);
    const enterPlatforms = () => {
      st.on = true; st.upper = false;
      game.setPlace(PLACE, game.worldScene, cols.lo, ground);
      game.player.teleport(spawn[0], spawn[1], barrierFacing + Math.PI); st.last = [spawn[0], spawn[1]];
      try { game.ui.area('Oxford station: the platforms'); } catch { /* */ }
    };
    const leavePlatforms = () => {
      st.on = false; st.upper = false;
      game.setPlace('world', game.worldScene, game.worldCollider, null);
      game.player.teleport(doorOut[0], doorOut[1], barrierFacing);
    };
    const fade = (fn) => { try { const r = game.ui.fade(fn); return r && r.then ? r : Promise.resolve(); } catch { fn(); return Promise.resolve(); } };
    game.interact.add({ place: 'world', pos: doorOut, radius: 2.2, label: `Buy a platform ticket (£${FARE.toFixed(2)}) and go through the barriers to watch the trains`, onUse: () => {
      if (!st.debugFree && !game.pay(-FARE)) { game.ui.toast(`A platform ticket is £${FARE.toFixed(2)}. The barrier stays shut.`, 3); return; }
      st.tickets = (st.tickets || 0) + 1;
      try { game.ui.toast('Beep. The barrier flaps open. Platform 1 is straight ahead, platform 2 over the footbridge.', 4); } catch { /* */ }
      fade(enterPlatforms);
    } });
    game.interact.add({ place: PLACE, pos: spawn, radius: 1.8, label: 'Back out through the barriers', onUse: () => fade(leavePlatforms) });
    const sights = [
      { id: 'oxford-station', name: 'Oxford station', x: ST.L(ST.ENTRANCE_S, ST.BLD.t1)[0], z: ST.L(ST.ENTRANCE_S, ST.BLD.t1)[1], blurb: 'The 1990 building of brick and glass on Park End Street: the city\'s front door from London and the north.' },
      { id: 'station-bikes', name: 'The station bike racks', x: ST.L(100, 29)[0], z: ST.L(100, 29)[1], blurb: 'Two tiers of racks packed with bikes, hundreds of them; some have not moved since Michaelmas.' },
      { id: 'station-footbridge', name: 'The footbridge', x: ST.L(1.3, 0)[0], z: ST.L(1.3, 0)[1], blurb: 'A covered bridge over the four roads between platforms 1 and 2.' },
      { id: 'station-platform-2', name: 'Platform 2', x: ST.L(40, -16)[0], z: ST.L(40, -16)[1], blurb: 'Stand behind the yellow line and watch the trains come in from the north.' },
    ];
    // ------------------------------------------------------------------------------------------ per frame
    function trainsTick() {
      const now = game.time.now() + (st.shift || 0), cam = game.camera.position, dc = Math.hypot(cam.x - centre[0], cam.z - centre[1]);
      const near = dc < 520 + (W.aerial ? 400 : 0);
      for (const tr of trains) {
        const s = TR.trainAt(tr.k, now), k = TR.carsShown(s.front);
        const show = near && k > 0;
        if (tr.m.visible !== show) tr.m.visible = show;
        if (show) {
          const p = ST.L(s.front, tr.T.t); _p.set(p[0], 0.27, p[1]); _m.compose(_p, _q, _s); tr.m.matrix.copy(_m); tr.m.matrixWorldNeedsUpdate = true;
          tr.m.geometry.setDrawRange(0, tg.carVerts[k - 1]);
        }
        // when two trains share the one geometry, the draw range is set per mesh just before it renders
        tr.k_ = k; tr.s = s;
        if (dc < 400) announce(tr, s);
      }
    }
    // the draw range lives on the shared geometry: set it per mesh as it is drawn
    for (const tr of trains) tr.m.onBeforeRender = () => { const k = tr.k_ || 0; if (k > 0) tr.m.geometry.setDrawRange(0, tg.carVerts[k - 1]); };
    function announce(tr, s) {
      const key = tr.T.id + ':' + s.n + ':' + s.phase;
      if (st.said[tr.T.id] === key) return;
      st.said[tr.T.id] = key;
      const dest = tr.T.dest[((s.n % tr.T.dest.length) + tr.T.dest.length) % tr.T.dest.length], hr = game.time.hour;
      const onPlat = st.on || Math.hypot(game.player.pos.x - centre[0], game.player.pos.z - centre[1]) < 120;
      const pl = game.audio && game.audio.ctx ? game.audio.place(...ST.L(60, tr.T.t), 260) : null;
      if (s.phase === 'in') {
        if (onPlat) try { game.ui.toast(`Platform ${tr.T.platform}: the train now approaching is the ${TR.hhmm(hr + 0.1)} service to ${dest}. Please stand behind the yellow line.`, 6); } catch { /* */ }
        if (pl && pl.gain > 0.01) { for (let i = 0; i < 18; i++) game.audio.noise(0.9, { freq: 90 + i * 2, gain: 0.05 * pl.gain * Math.min(1, i / 6), when: i * 1.2, pan: pl.pan }); game.audio.tone(2400, 1.4, { gain: 0.025 * pl.gain, when: 24, type: 'sawtooth' }); }
      } else if (s.phase === 'dwell') {
        if (onPlat) try { game.ui.toast(`This train is for ${dest}. Mind the gap between the train and the platform.`, 5); } catch { /* */ }
        if (pl && pl.gain > 0.01) { game.audio.tone(880, 0.25, { gain: 0.05 * pl.gain, when: 0.2 }); game.audio.tone(660, 0.35, { gain: 0.05 * pl.gain, when: 0.45 }); }
      } else if (s.phase === 'out') {
        if (pl && pl.gain > 0.01) { game.audio.tone(392, 0.7, { type: 'square', gain: 0.04 * pl.gain, pan: pl.pan }); game.audio.tone(330, 0.9, { type: 'square', gain: 0.04 * pl.gain, when: 0.75, pan: pl.pan }); for (let i = 0; i < 16; i++) game.audio.noise(0.9, { freq: 110 - i * 2, gain: 0.05 * pl.gain * Math.max(0, 1 - i / 16), when: 0.5 + i * 1.2, pan: pl.pan }); }
      }
    }
    function platformsTick() {
      if (!st.on) return;
      const p = game.player.pos;
      let z = ST.zoneAt(p.x, p.z, st.upper);
      if (z === 'stair') st.upper = ST.floorAt(p.x, p.z, true) > (ST.PLAT.y + ST.BRIDGE.y) / 2;
      else if (z === 'p1' || z === 'p2') st.upper = false;
      z = ST.zoneAt(p.x, p.z, st.upper);
      if (!z) { p.x = st.last[0]; p.z = st.last[1]; } else st.last = [p.x, p.z];
      const c = st.upper ? cols.up : cols.lo;
      if (game.collider !== c) game.collider = c;
    }
    function boardsTick() {
      const cam = game.camera.position, dc = Math.hypot(cam.x - centre[0], cam.z - centre[1]), on = dc < 110 && (game.player.place === 'world' || game.player.place === PLACE);
      if (DB.mesh.visible !== on) DB.mesh.visible = on;
      if (on) drawBoards(game.time.now(), game.time.hour);
    }
    function tick(dt) {
      S.tick('oxford_station');
      boardsTick();
      platformsTick();
      trainsTick();
      signsTick(signs, game.camera, 30);
      void dt;
    }
    game.station = {
      sights, trains, trainAt: TR.trainAt, departures: (now, h) => departures(now, h), boards: DB, colliders: cols, zone: () => ({ upper: st.upper, on: st.on }),
      /** put train k at `intoMs` of its cycle (screenshots, tests): shifts this client's train clock only */
      debugTrain(k, intoMs) { const T = TR.TRAINS[k], now = game.time.now(); st.shift = 0; const cur = (((now - T.offset) % TR.CYCLE) + TR.CYCLE) % TR.CYCLE; st.shift = intoMs - cur; return st.shift; },
      debugPlatforms(on) { if (on) enterPlatforms(); else if (st.on) leavePlatforms(); return st.on; },
      stats() { return { lod: S.stats.station, bikes: ST.build.bikes, trains: trains.map((t) => ({ id: t.T.id, visible: t.m.visible, cars: t.k_, phase: t.s && t.s.phase })), tickets: st.tickets || 0 }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!st.err) { st.err = true; console.error('[oxford_station]', e); } } } };
  },
};

function inPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) c = !c; } return c; }
