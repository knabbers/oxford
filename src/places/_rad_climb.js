// The St Mary's tower climb: pay at the door, 127 steps (a fade), then walk the gallery round the foot of the spire,
// 26 m up, with the Radcliffe Camera below. The gallery is its own "place" ('rad_tower') that renders the WORLD scene
// (game.setPlace with the world scene, a small collider of its own and a flat floor at the gallery's height), so the view
// is the real city; its collider is two closed square rings (the spire's plinth, the parapet), so the player cannot fall
// or jump off: collision is 2D and a jump comes down on the same floor. A camera hook gives a first-person view over the parapet
// (chained to whatever hook was there before, e.g. swimming's).
import { Collider } from '../core/collision.js';
import { TOWER, towerPt, towerHeading } from './_rad_stmary.js';

export const PLACE = 'rad_tower', PRICE = 4;
const VIEW_LINES = ['The Radcliffe Camera, from above: the dome is lead, all 41 tonnes of it.', 'Due north: the Camera, the Bodleian, and the Sheldonian\'s cupola beyond.', 'West: Brasenose and the Turl; east: All Souls\' twin towers.'];

export function createClimb(game, opts = {}) {
  const T = TOWER, floorY = T.belfry + 0.02;
  const col = new Collider();
  const sq = (r) => [[-r, -r], [r, -r], [r, r], [-r, r]].map(([x, z]) => towerPt(x, z));
  col.addPolygon(sq(T.walk[0]));            // the spire's plinth
  col.addPolygon(sq(T.walk[1]));            // the parapet
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) {   // the corner pinnacles' bases reach into the corners
    const [x, z] = towerPt(sa * (T.half - 0.1), sb * (T.half - 0.1)); col.addCircle(x, z, 0.48);
  }
  // a hard clamp to the tower's footprint (the collider's bounds) and a guard: if a long frame ever carries the player
  // through a ring, they are put back where they last stood on the walk
  { const R = sq(T.walk[1] + 0.2); col.bounds = { minX: Math.min(...R.map((p) => p[0])), maxX: Math.max(...R.map((p) => p[0])), minZ: Math.min(...R.map((p) => p[1])), maxZ: Math.max(...R.map((p) => p[1])) }; }
  const [ux, uz] = T.u, nx = uz, nz = -ux;
  const localM = (x, z) => { const dx = x - T.centre[0], dz = z - T.centre[1]; return Math.max(Math.abs(dx * ux + dz * uz), Math.abs(dx * nx + dz * nz)); };
  const last = { x: 0, z: 0 };
  function guard() {
    if (!S.on) return false;
    const p = game.player.pos, m = localM(p.x, p.z);
    if (m < T.walk[0] + 0.2 || m > T.walk[1] - 0.2) { p.x = last.x; p.z = last.z; return true; }
    last.x = p.x; last.z = p.z; return false;
  }
  const S = { on: false, prevHook: null, hooked: false, door: null, said: 0, entered: 0 };
  const spawn = towerPt(0, 3.05), stair = towerPt(T.walk[0] + 0.5, T.walk[0] + 0.5);
  // the stair head: in the gallery's south-west corner (on the side of the church), where you came out
  const exitPt = towerPt(-3.07, -3.07);

  // first person on the gallery (as the visitor sees it: over the parapet), the head hidden; mouse looks round
  function hook(dt, cam) {
    if (!S.on) { if (S.headHidden) showHead(true); return S.prevHook ? S.prevHook(dt, cam) : false; }
    const inp = game.input, p = game.player;
    if (inp.locked) { game.cameraYaw -= inp.mouseDX * 0.0026; game.cameraPitch = Math.max(-0.9, Math.min(1.2, game.cameraPitch + inp.mouseDY * 0.0022)); }
    if (!S.headHidden) showHead(false);
    const cp = Math.cos(game.cameraPitch), sp = Math.sin(game.cameraPitch), fx = Math.sin(game.cameraYaw) * cp, fz = Math.cos(game.cameraYaw) * cp;
    const D = p.character && p.character.dims, eye = p.pos.y + (D ? (D.top || 1.7) - 0.1 : 1.6);
    cam.position.set(p.pos.x + fx * 0.12, eye, p.pos.z + fz * 0.12);
    cam.lookAt(p.pos.x + fx * 5, eye - sp * 5, p.pos.z + fz * 5);
    return true;
  }
  function showHead(on) { try { const b = game.player.character.bones; if (b && b.head) b.head.visible = on; } catch { /* */ } S.headHidden = !on; }
  function ensureHook() { if (S.hooked) return; S.prevHook = game.cameraHook; game.cameraHook = hook; S.hooked = true; }

  function up() {
    if (S.on) return true;
    ensureHook();
    game.setPlace(PLACE, game.worldScene, col, () => floorY);
    game.player.teleport(spawn[0], spawn[1], towerHeading(0, 1)); last.x = spawn[0]; last.z = spawn[1];
    game.cameraYaw = game.player.heading; game.cameraPitch = 0.3;
    S.on = true; S.entered++;
    try { game.ui.area('St Mary\'s tower: the gallery'); game.ui.toast('127 steps later: the gallery round the spire. ' + VIEW_LINES[S.entered % VIEW_LINES.length], 7); } catch { /* */ }
    return true;
  }
  function down() {
    if (!S.on) return;
    S.on = false; showHead(true);
    game.setPlace('world', game.worldScene, game.worldCollider, null);
    const d = S.door || opts.doors[0];
    game.player.teleport(d.pos[0] + Math.sin(d.facing) * 1.3, d.pos[1] + Math.cos(d.facing) * 1.3, d.facing);
    game.cameraYaw = game.player.heading;
  }
  const fade = (fn) => { try { const r = game.ui.fade(fn); return r && r.then ? r : Promise.resolve(); } catch { fn(); return Promise.resolve(); } };

  // doors: pay and climb
  for (const d of opts.doors || []) {
    game.interact.add({ place: 'world', pos: d.pos, radius: 1.9, label: () => `Climb the tower (£${PRICE}, 127 steps)`, onUse: () => {
      const st = game.state || {};
      if ((st.money ?? 0) < PRICE) { game.ui.toast(`The tower is £${PRICE}. You have £${(st.money ?? 0).toFixed ? (st.money ?? 0).toFixed(2) : st.money}.`, 4); return; }
      game.pay(-PRICE); S.door = d;
      try { game.ui.toast('Up the turret stair: past the Old Library, past the ringing chamber… mind your head.', 3); } catch { /* */ }
      fade(() => up());
    } });
  }
  // the way down (at the stair head), and a look-out spot facing the Camera
  game.interact.add({ place: PLACE, pos: [exitPt[0], exitPt[1]], radius: 1.5, label: 'Go back down the stairs', onUse: () => fade(() => down()) });
  game.interact.add({ place: PLACE, pos: [spawn[0], spawn[1]], radius: 1.0, label: 'Look out over the Radcliffe Camera', onUse: () => {
    S.said++; try { game.ui.toast(VIEW_LINES[S.said % VIEW_LINES.length], 5); } catch { /* */ }
    game.cameraYaw = towerHeading(0, 1); game.cameraPitch = 0.35;
  } });
  void stair;
  return {
    get on() { return S.on; }, up, down, guard, localM, collider: col, floorY, spawn, exitPt,
    /** debug: put the player on the gallery (true) or back down (false) without paying */
    debug(on) { if (!S.door) S.door = (opts.doors || [])[0]; if (on) up(); else down(); return S.on; },
  };
}
