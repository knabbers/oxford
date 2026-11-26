// Salter's Steamers ("Grandpont Boats" under ?invented=1): hire a rowing boat at the kiosk on Folly Island and row it yourself on the Isis.
//
//   [E] at the kiosk (£3)       you step into the hire boat moored off the pontoon (the east one of the three; the
//                               other two stay scenery in the batch-4 waterfront draw)
//   W / S                       pull / back water. You sit facing the stern, like a real sculler: the boat goes the way
//                               your back is facing, and the view follows the bow (core/_chasecam.js)
//   A / D                       pull one oar and back the other: she turns on the spot, or curves while under way
//   F                           step out at a bank, a landing stage or the pontoon
//   [F] by the boat             back in, once she is yours (until she goes home)
// Left within 12 m of her mooring she is tied up again (£1 back); left anywhere else she is brought home by the boat
// hire 2 minutes after nobody is near and she is out of sight (as other vehicles go back to their bays). The boats do
// not go under Folly Bridge (the world is flat: the deck is at road level), and they bump off banks, stages and the
// steamer (systems/steamer.js hullHit).
//
// While rowing the player's vehicle is a small record of our own ({type: 'rowboat', kind: 'rowboat', heading, speed,
// camDist}) - systems/vehicles.js does not know it (its .cur stays null), police and traffic ignore it, the follow
// camera chases its heading. Multiplayer adds nothing to the wire: the state already says vehicle type 'rowboat' and
// pose 'drive', and game.vehicles.createMesh is wrapped so watchers draw our boat (oars moving with the reported speed)
// with the rower in it facing the stern. Nobody shares a boat: each player hires their own.
//
// Cost: three draws (hull, two oars) within 150 m of the camera; nothing else. Test hooks: game.boathire   tools/smoke_todo.mjs
import * as THREE from 'three';
import { b4Pack, geoOf, RB, frame } from '../places/_b4_kit.js';
import { BOATS, PUNTS } from '../places/_b4_folly.js';
import { tn } from '../core/features.js';

/** who hires the boats out: Salter's (the real Folly Bridge firm) or, under ?invented=1, an invented one */
export const HIRER = tn('Salter’s', 'Grandpont Boats');
export const HIRE = { fee: 3, refund: 1, home: BOATS[2], kiosk: [266.4, 975.2], homeR: 12, awayS: 120 };
export const BOAT = { L: 4.2, B: 1.25, seatU: -0.15, seatY: -0.12, lockU: -0.48, lockW: 0.64, lockY: 0.42, inboard: 0.72, outboard: 1.62 };
// rowing (m/s^2, rad/s^2): a drive phase of the stroke pushes, the water slows her (linear + quadratic)
// the hull's water test points (u along, w across), flat so a frame's test allocates nothing
const HULL_PTS = (() => { const hl = 4.2 / 2, hw = 1.25 / 2; return [hl, 0, hl - 0.7, hw, hl - 0.7, -hw, 0, hw, 0, -hw, -hl, hw * 0.9, -hl, -hw * 0.9]; })();
// moored scenery to bump into: [x, z, heading, length, beam]
const MOORED = [...PUNTS.map(([x, z, h]) => [x, z, h, 7.3, 0.9]), ...BOATS.slice(0, 2).map(([x, z, h]) => [x, z, h, 4.2, 1.2])];
export const ROW = { period: 1.55, drive: 0.42, thrust: 2.5, back: 1.7, lin: 0.32, quad: 0.16, yaw: 1.5, yawDamp: 2.2, maxW: 0.75 };

/** one step of the boat's motion (pure): st {v, w, ph}, keys fwd (-1..1), turn (-1..1, + = to port / left) */
export function rowStep(st, fwd, turn, dt) {
  const pS = Math.max(-1, Math.min(1, fwd + turn)), pP = Math.max(-1, Math.min(1, fwd - turn));
  const active = Math.abs(pS) > 0.05 || Math.abs(pP) > 0.05;
  if (active) st.ph = (st.ph + dt / ROW.period) % 1; else if (st.ph > 0.001) st.ph = Math.min(1, st.ph + dt / ROW.period) % 1;
  const inDrive = active && st.ph < ROW.drive, k = inDrive ? Math.sin(Math.PI * st.ph / ROW.drive) * 1.6 : 0;
  const mean = (pS + pP) / 2, a = mean * k * (mean >= 0 ? ROW.thrust : ROW.back);
  st.v += (a - ROW.lin * st.v - ROW.quad * st.v * Math.abs(st.v)) * dt;
  // one oar pulling, the other backing (or held): she yaws; under way the keel resists a little
  const ya = (pS - pP) * 0.5 * (inDrive ? k : 0.35) * ROW.yaw;
  st.w += (ya - ROW.yawDamp * st.w) * dt;
  if (st.w > ROW.maxW) st.w = ROW.maxW; else if (st.w < -ROW.maxW) st.w = -ROW.maxW;
  return st;
}

export default {
  id: 'boathire',
  install(game) {
    const S = {
      err: false, hooked: false, hired: false, mine: false, x: HIRE.home[0], z: HIRE.home[1], h: HIRE.home[2], v: 0, w: 0, ph: 0, rp: 0,
      awayT: 0, bumpT: 0, bridgeTold: false, rows: 0, hires: 0, returns: 0, homes: 0, dist: 0, tipShown: false,
    };
    const col = game.worldCollider, scene = game.worldScene;
    const veh = { type: 'rowboat', kind: 'rowboat', name: 'rowing boat', x: S.x, z: S.z, heading: S.h, speed: 0, camDist: 1.25, boat: true };
    let geos = null, boat = null, oarP = null, oarS = null, pack = null;
    // ---------------------------------------------------------------- the mesh (built once, in the batch-4 atlas)
    function buildGeos() {
      pack = b4Pack(game.world);
      const L = BOAT.L, hw = BOAT.B / 2;
      const B = new RB();
      B.push(frame(0, 0, 0, 1, 0));      // local x = mesh x (port), local z = mesh z (bow)
      // an open hull: the bottom, two planked sides with white gunwales, floorboards
      B.box('varnish', 0, -0.11, -0.2, BOAT.B - 0.06, 0.04, L - 0.8, 0, { bottom: true });
      for (const s of [-1, 1]) {
        B.box('varnish', s * (hw - 0.04), 0.13, -0.2, 0.05, 0.48, L - 0.8, 0, { bottom: true });
        B.box('white', s * (hw - 0.03), 0.38, -0.2, 0.09, 0.04, L - 0.76, 0, { bottom: true });
      }
      B.box('deck', 0, 0.06, -0.2, BOAT.B - 0.2, 0.02, L - 1.0, 0);
      // the pointed bow and the stern's transom
      const zb = (L - 0.8) / 2 - 0.2;
      B.poly('varnish', [[-hw + 0.02, -0.12, zb], [0, -0.06, zb + 0.6], [0, 0.4, zb + 0.72], [-hw + 0.02, 0.38, zb]], [-1, 0, 1]);
      B.poly('varnish', [[0, -0.06, zb + 0.6], [hw - 0.02, -0.12, zb], [hw - 0.02, 0.38, zb], [0, 0.4, zb + 0.72]], [1, 0, 1]);
      B.poly('deck', [[-hw + 0.02, 0.37, zb], [hw - 0.02, 0.37, zb], [0, 0.39, zb + 0.7]], [0, 1, 0]);
      B.box('oak', 0, 0.12, -L / 2 + 0.2, BOAT.B - 0.06, 0.5, 0.05, 0);
      // thwarts: the rower's, the passenger's in the stern sheets; the rowlocks on the gunwales
      B.box('oak', 0, 0.3, BOAT.seatU, BOAT.B - 0.08, 0.05, 0.28, 0);
      B.box('oak', 0, 0.26, -1.45, BOAT.B - 0.1, 0.05, 0.5, 0);
      B.box('oak', 0, 0.26, 1.0, BOAT.B - 0.14, 0.05, 0.25, 0);
      for (const s of [-1, 1]) B.box('iron', s * BOAT.lockW, 0.42, BOAT.lockU, 0.05, 0.1, 0.05, 0, { top: false });
      B.pop();
      const hull = geoOf(B, pack);
      // an oar along +x from its pivot: handle inboard, loom, blade outboard
      const O = new RB();
      O.push(frame(0, 0, 0, 1, 0));
      O.beam('oak', [-BOAT.inboard, 0, 0], [BOAT.outboard - 0.5, 0, 0], 0.045);
      O.box('white', BOAT.outboard - 0.25, 0, 0, 0.5, 0.025, 0.15, 0);
      O.box('navy', -BOAT.inboard + 0.08, 0, 0, 0.16, 0.05, 0.05, 0);
      O.pop();
      return { hull, oar: geoOf(O, pack) };
    }
    /** hull + two oars in a group (origin = the boat's waterline middle, +z = bow) */
    function makeBoat(name) {
      if (!geos) geos = buildGeos();
      const g = new THREE.Group(); g.name = name; g.rotation.order = 'YXZ';
      const hull = new THREE.Mesh(geos.hull, pack.atlas); hull.castShadow = true; hull.name = name + ':hull'; g.add(hull);
      const oars = [];
      for (const s of [1, -1]) {
        const piv = new THREE.Group(); piv.position.set(s * BOAT.lockW, BOAT.lockY, BOAT.lockU); piv.rotation.order = 'YXZ';
        const m = new THREE.Mesh(geos.oar, pack.atlas); m.name = name + ':oar'; m.castShadow = true;
        if (s < 0) m.rotation.y = Math.PI;      // the starboard oar points to -x
        piv.add(m); g.add(piv); oars.push(piv);
      }
      g.userData.oars = oars;
      return g;
    }
    /** oars at stroke phase ph (0..1) for powers pP (port) / pS (starboard); stowed = lying along the boat */
    function poseOars(oars, ph, pP, pS, stowed) {
      for (let i = 0; i < 2; i++) {
        const piv = oars[i], s = i === 0 ? 1 : -1, pw = i === 0 ? pP : pS;
        if (stowed) { piv.rotation.set(0, s * 1.45, s * 0.1); continue; }
        // the drive: blades in the water, swept from towards the bow to towards the stern (backing: the other way);
        // the recovery: blades lifted and carried back
        const drive = ph < ROW.drive, t = drive ? ph / ROW.drive : (ph - ROW.drive) / (1 - ROW.drive);
        const sweep = Math.abs(pw) < 0.05 ? 0 : (drive ? 0.62 - 1.24 * t : -0.62 + 1.24 * (0.5 - 0.5 * Math.cos(Math.PI * t))) * Math.sign(pw);
        const lift = Math.abs(pw) < 0.05 ? -0.06 : drive ? 0.2 : -0.14;       // + = blade down (in the water)
        piv.rotation.set(0, s * sweep, s * lift);
      }
    }
    try {
      boat = makeBoat('boathire');
      oarP = boat.userData.oars[0]; oarS = boat.userData.oars[1];
      poseOars(boat.userData.oars, 0, 0, 0, true);
      scene.add(boat);
    } catch (e) { console.error('[boathire] build', e); }

    const toast = (t, s = 5) => { try { game.ui.toast(t, s); } catch { /* */ } };
    const wet = (x, z) => col.isWet(x, z);
    const _f = { x: 0, z: 0 };
    /** do the hull's sample points all float, clear of banks, stages, bridges and the steamer? */
    function fits(x, z, h) {
      const s = Math.sin(h), c = Math.cos(h);
      for (let i = 0; i < HULL_PTS.length; i += 2) {
        const u = HULL_PTS[i], w = HULL_PTS[i + 1], px = x + s * u + c * w, pz = z + c * u - s * w;
        if (!wet(px, pz)) { _f.x = px; _f.z = pz; return false; }
      }
      // the moored punts and the other two hire boats off the pontoon (scenery in the waterfront draw)
      for (let k = -1; k <= 1; k++) {
        const cx = x + s * k * 1.4, cz = z + c * k * 1.4;
        for (const o of MOORED) { const dx = cx - o[0], dz = cz - o[1], ou = dx * Math.sin(o[2]) + dz * Math.cos(o[2]), ow = dx * Math.cos(o[2]) - dz * Math.sin(o[2]); if (Math.abs(ou) < o[3] / 2 + 0.6 && Math.abs(ow) < o[4] / 2 + 0.6) { _f.x = cx; _f.z = cz; return false; } }
      }
      const st = game.steamer, hl = BOAT.L / 2;
      if (st && st.hullHit && (st.hullHit(x + s * hl * 0.7, z + c * hl * 0.7, 0.5) || st.hullHit(x - s * hl * 0.7, z - c * hl * 0.7, 0.5) || st.hullHit(x, z, 0.6))) { _f.x = x; _f.z = z; return false; }
      return true;
    }
    const blockedByBridge = () => col.onBridge(_f.x, _f.z) && Math.hypot(_f.x - 254, _f.z - 958) < 32;     // (Folly Bridge, not the pontoon)

    // ---------------------------------------------------------------- in and out
    const p = () => game.player;
    function seatPlayer() {
      const P = p(), s = Math.sin(S.h), c = Math.cos(S.h);
      P.pos.set(S.x + s * BOAT.seatU, BOAT.seatY, S.z + c * BOAT.seatU);
      P.heading = S.h + Math.PI;
      if (P.place === 'world') P.worldPos.copy(P.pos);
      const grp = P.character.group; grp.rotation.order = 'YXZ';
      grp.position.copy(P.pos); grp.rotation.set(S.lean || 0, P.heading, 0);
    }
    function board() {
      const P = p();
      if (P.place !== 'world' || P.vehicle || P.swim || P.down) return false;
      S.mine = true; S.v = 0; S.w = 0; S.ph = 0; S.awayT = 0; S.rows++;
      veh.x = S.x; veh.z = S.z; veh.heading = S.h; veh.speed = 0;
      P.vehicle = veh; P.pose = 'drive'; try { P.character.setPose('drive'); } catch { /* */ }
      P.vx = P.vz = 0; P.speed = 0;
      seatPlayer();
      const fl = game.state.flags || (game.state.flags = {});
      if (!fl.rowTip) { fl.rowTip = true; try { game.save(); } catch { /* */ } toast('You sit facing the stern, like a real sculler. W pulls (the boat goes the way your back is facing), S backs water, A / D turn her, F gets out at a bank.', 8); }
      return true;
    }
    function hire() {
      const P = p();
      if (S.mine || P.vehicle) return false;
      if (S.hired) { toast('She is still yours: the green-trimmed one off the pontoon, or wherever you left her.', 4); return false; }
      if (!game.pay(-HIRE.fee)) { toast(`A rowing boat is £${HIRE.fee}. You have not got £${HIRE.fee}.`, 4); return false; }
      S.hired = true; S.hires++;
      goHome();
      toast(`${HIRER}: £${HIRE.fee}. "She's the one at the end. Bring her back to the pontoon and you get £${HIRE.refund} back. Not under the bridge, mind."`, 6);
      return board();
    }
    /** find a dry, open spot beside the boat to step out to */
    function exitSpot() {
      const s = Math.sin(S.h), c = Math.cos(S.h);
      for (const u of [BOAT.seatU, 0.8, -1.2, 1.6, -1.9]) for (const w of [1.1, -1.1, 1.6, -1.6, 2.2, -2.2, 2.9, -2.9]) {
        const x = S.x + s * u + c * w, z = S.z + c * u - s * w;
        if (!wet(x, z) && col.isFree(x, z, 0.33)) return [x, z];
      }
      for (const u of [BOAT.L / 2 + 0.8, -BOAT.L / 2 - 0.8, BOAT.L / 2 + 1.5]) { const x = S.x + s * u, z = S.z + c * u; if (!wet(x, z) && col.isFree(x, z, 0.33)) return [x, z]; }
      // anywhere dry within a long step (the pontoon's edge, a stage, a bank at an angle)
      for (let r = 1.2; r <= 4.4; r += 0.4) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, x = S.x + Math.sin(a) * r, z = S.z + Math.cos(a) * r; if (!wet(x, z) && col.isFree(x, z, 0.33)) return [x, z]; }
      return null;
    }
    function getOut(force = false) {
      const P = p();
      if (!S.mine) return false;
      const spot = exitSpot();
      if (!spot && !force) { toast('You are mid-river: row to the bank (or the pontoon) first.', 3); return false; }
      S.mine = false; S.v = 0; S.w = 0;
      if (P.vehicle === veh) P.vehicle = null;
      P.pose = 'stand'; try { P.character.setPose('stand'); } catch { /* */ }
      const grp = P.character.group; grp.rotation.x = 0; grp.rotation.z = 0;
      if (spot) P.pos.set(spot[0], game.groundHeight(spot[0], spot[1]), spot[1]);
      P.vx = P.vz = 0; P.vy = 0; P.speed = 0; P.onGround = true; if (P.syncMesh) P.syncMesh();
      poseOars(boat.userData.oars, 0, 0, 0, true);
      // brought back to the pontoon: tied up, the deposit back
      if (Math.hypot(S.x - HIRE.home[0], S.z - HIRE.home[1]) < HIRE.homeR) {
        goHome(); S.hired = false; S.returns++;
        game.pay(HIRE.refund); toast(`You tie her up at the pontoon. ${HIRER} give you £${HIRE.refund} back.`, 4);
      }
      return true;
    }
    function goHome() { S.x = HIRE.home[0]; S.z = HIRE.home[1]; S.h = HIRE.home[2]; S.v = 0; S.w = 0; S.awayT = 0; poseOars(boat.userData.oars, 0, 0, 0, true); }
    try {
      game.interact.add({ pos: HIRE.kiosk, radius: 2.2, label: () => (S.hired ? HIRER + ': where is my boat?' : `Hire a rowing boat (£${HIRE.fee})`), enabled: () => !S.mine && !game.player.vehicle, onUse: () => hire() });
      const bp = new THREE.Vector3();
      game.interact.add({ key: 'F', pos: () => bp.set(S.x, 0, S.z), radius: 2.6, label: 'Row the boat', enabled: () => S.hired && !S.mine && !game.player.vehicle && !game.player.swim, onUse: () => board() });
    } catch (e) { console.warn('[boathire] interact', e); }

    // ---------------------------------------------------------------- watchers: other players' boats
    const ghosts = new Set();
    function hook() {
      const V = game.vehicles; if (!V || S.hooked) return;
      S.hooked = true;
      const orig = V.createMesh;
      V.createMesh = function (type, color, livery) {
        if (type !== 'rowboat') return orig.call(this, type, color, livery);
        // the remote state is the rower's seat with the rower's heading (facing the stern): the boat is turned round
        const grp = new THREE.Group(); grp.name = 'remote-vehicle:rowboat';
        const b = makeBoat('remote-rowboat'); b.rotation.y = Math.PI; b.position.set(0, -BOAT.seatY, BOAT.seatU);
        grp.add(b); grp.userData.oars = b.userData.oars; grp.userData.ph = 0; ghosts.add(grp);
        return grp;
      };
    }
    function animGhosts(dt) {
      if (!ghosts.size) return;
      const others = game.net && game.net.others;
      for (const g of ghosts) {
        if (!g.parent) { if (g.userData.added) ghosts.delete(g); continue; }
        g.userData.added = true;
        let sp = 0; if (others) for (const o of others.values()) if (o.ghost === g) { sp = o.speed || 0; break; }
        const pw = sp > 0.2 ? 1 : 0; if (pw) g.userData.ph = (g.userData.ph + dt / ROW.period) % 1;
        poseOars(g.userData.oars, g.userData.ph, pw, pw, false);
      }
    }

    // ---------------------------------------------------------------- per frame
    const st = { v: 0, w: 0, ph: 0 };
    function tick(dt) {
      hook(); animGhosts(dt);
      const P = p(), inp = game.input;
      if (boat) { const cam = game.camera.position; boat.visible = P.place === 'world' && Math.hypot(cam.x - S.x, cam.z - S.z) < 150; }
      if (S.mine) {
        // somebody else moved us (a door, a teleport, the police): leave her where she is
        if (P.vehicle !== veh || P.place !== 'world') { S.mine = false; if (P.vehicle === veh) P.vehicle = null; if (P.pose === 'drive') { P.pose = 'stand'; try { P.character.setPose('stand'); } catch { /* */ } } return; }
        const ctl = !P.frozen && !game.activity && !(game.ui && game.ui.inDialog) && !inp.typing;
        let fwd = 0, turn = 0;
        if (ctl) { fwd = (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0) - (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0); turn = (inp.down('KeyA') || inp.down('ArrowLeft') ? 1 : 0) - (inp.down('KeyD') || inp.down('ArrowRight') ? 1 : 0); }
        st.v = S.v; st.w = S.w; st.ph = S.ph;
        rowStep(st, fwd, turn, dt);
        S.v = st.v; S.w = st.w; S.ph = st.ph;
        const pS = Math.max(-1, Math.min(1, fwd + turn)), pP = Math.max(-1, Math.min(1, fwd - turn));
        // move, sliding along what she bumps into
        const nh = S.h + S.w * dt, nx = S.x + Math.sin(nh) * S.v * dt, nz = S.z + Math.cos(nh) * S.v * dt;
        if (fits(nx, nz, nh)) { S.dist += Math.hypot(nx - S.x, nz - S.z); S.x = nx; S.z = nz; S.h = nh; }
        else if (fits(S.x, S.z, nh)) { S.h = nh; S.v *= -0.25; bump(); }
        else if (fits(nx, nz, S.h)) { S.x = nx; S.z = nz; S.w *= -0.3; }
        else { S.v *= -0.3; S.w *= -0.3; bump(); }
        S.lean = -0.22 * Math.sin(2 * Math.PI * S.ph) * (Math.abs(pS) + Math.abs(pP) > 0.1 ? 1 : 0);
        poseOars(boat.userData.oars, S.ph, pP, pS, false);
        veh.x = S.x; veh.z = S.z; veh.heading = S.h; veh.speed = S.v;
        seatPlayer();
        if (ctl && inp.hit('KeyF')) { inp.pressed.delete('KeyF'); getOut(); }
      } else if (S.hired) {
        // drifting to a stop where she was left; home after 2 minutes alone and out of sight
        if (Math.abs(S.v) > 0.01) { S.v *= Math.exp(-0.8 * dt); const nx = S.x + Math.sin(S.h) * S.v * dt, nz = S.z + Math.cos(S.h) * S.v * dt; if (fits(nx, nz, S.h)) { S.x = nx; S.z = nz; } else S.v = 0; }
        const far = Math.hypot(P.pos.x - S.x, P.pos.z - S.z) > 60 || P.place !== 'world';
        const cam = game.camera.position, seen = P.place === 'world' && Math.hypot(cam.x - S.x, cam.z - S.z) < 90;
        S.awayT = far && !seen ? S.awayT + dt : 0;
        if (S.awayT > HIRE.awayS) { goHome(); S.hired = false; S.homes++; }
      }
      if (boat) { boat.position.set(S.x, Math.sin((game.elapsed || 0) * 1.7) * 0.012, S.z); boat.rotation.set(S.mine ? -0.012 * S.v : 0, S.h, Math.sin((game.elapsed || 0) * 1.3) * 0.01); }
      if (S.bumpT > 0) S.bumpT -= dt;
    }
    function bump() {
      if (S.bumpT > 0) return; S.bumpT = 0.6;
      try { const A = game.audio; if (A && A.ctx) A.noise(0.12, { gain: 0.08, freq: 320, q: 0.8 }); } catch { /* */ }
      if (!S.bridgeTold && blockedByBridge()) { S.bridgeTold = true; toast('The hire boats stay below the bridge. (There is no room under it in this Oxford.)', 4); }
    }

    game.boathire = {
      hire, board, getOut, goHome, rowStep, fits,
      get state() { return S; },
      stats: () => ({ hired: S.hired, mine: S.mine, x: +S.x.toFixed(2), z: +S.z.toFixed(2), h: +S.h.toFixed(3), v: +S.v.toFixed(2), hires: S.hires, returns: S.returns, homes: S.homes, dist: Math.round(S.dist), hooked: S.hooked, visible: !!(boat && boat.visible) }),
    };
    return { id: 'boathire', update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[boathire]', e); } } } };
  },
};
