// The gliding club's airfield dressing (plain, correctly sized props; the visual pass may restyle _gc_props.js).
// The ground, the lane, hedges, hedgerow trees, the hangar and the clubhouse are map data appended in preMap by
// systems/gliding.js (systems/_glide_site.js) and drawn by the world like the rest of Oxford. This module adds what
// the map cannot say: the launch-point caravan, the winch truck and its cable-retrieve Land Rover at the far end, the
// windsock (it shows the day's wind, which is the wind the gliders fly in), a row of glider trailers, a "Gliding Club"
// signpost where Airfield Lane leaves Marston Road, a field gate, and a briefing board by the launch point
// ([E] the controls and today's soaring forecast).
// Cost: one merged static mesh + the windsock (2 draws), in the scene only within ~1.6 km of the field.
import * as THREE from 'three';
import { SITE } from '../systems/_glide_site.js';
import { buildProps, buildWindsock, signTexture } from './_gc_props.js';
import { dayWeather, diurnal } from '../systems/_glide_air.js';

const NEAR = 1600;

export default {
  id: 'gliding_club',
  install(game) {
    const scene = game.worldScene, ground = (x, z) => (game.world && game.world.groundHeight ? game.world.groundHeight(x, z) : 0);
    let built = null;
    const build = () => {
      const props = buildProps(ground);
      const sock = buildWindsock();
      sock.group.position.set(SITE.windsock[0], ground(SITE.windsock[0], SITE.windsock[1]), SITE.windsock[1]);
      const tex = signTexture();
      if (tex) {
        // the fingerpost board at the end of Marston Road, and the club's name board on the clubhouse
        const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
        const L0 = SITE.lane[0];
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 0.05), m); board.position.set(L0[0] - 4.2, 2.0, L0[1] - 1); board.rotation.y = Math.PI / 2 + 0.25; props.add(board);
        const nb = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 0.06), m); const c = SITE.clubhouse; nb.position.set((c[0][0] + c[1][0]) / 2, 3.1, c[2][1] + 0.06); props.add(nb);
      }
      props.updateMatrixWorld(true);
      props.traverse((o) => { o.matrixAutoUpdate = false; });
      return { props, sock };
    };
    // Loading screen (game.warmups, world/prewarm.js): built now and drawn once out of sight (world.warmDraw) — it used
    // to be built in the frame the player first came within NEAR (~17 ms) and its programs linked on the first draw
    (game.warmups || (game.warmups = [])).push({ id: 'gliding_club', fn: () => {
      const W = game.world; if (!W || !W.warmDraw) return null;
      if (!built) built = build();
      const o = { prio: 1, id: 'gliding_club' }, ps = [W.warmDraw(built.props, o), W.warmDraw(built.sock.group, o)].filter(Boolean);
      return ps.length ? Promise.all(ps) : null;
    } });
    // the briefing board: controls + today's forecast (wind, thermals, cloud base) from the same air model the gliders fly in
    if (game.interact) {
      const B = [SITE.launchBus[0] + 9, SITE.launchBus[1] - 3];
      game.interact.add({ pos: B, radius: 2.6, label: 'Read the briefing board', onUse: () => {
        const hr = game.time.hour, w = dayWeather(game.time.now(), hr), dn = diurnal(hr) * w.sky;
        const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((w.fromDeg % 360) + 360) % 360 / 45) % 8];
        const thermals = dn > 0.6 ? 'good, booming by mid-afternoon' : dn > 0.25 ? 'weak to moderate' : hr < 10 ? 'none yet: they start about 10:00' : hr > 19 ? 'over for the day' : 'poor';
        const lines = [
          `Today: ${w.name}. Wind from the ${compass}, ${Math.round(w.speed * 1.94)} knots at 1,000 ft.`,
          `Thermals: ${thermals}. Cloud base about ${Math.round(w.base * 3.28 / 100) * 100} ft.${w.rain > 0.03 ? ' Rain about: no thermals in it.' : ''}`,
          'Get in either two-seater with F. L launches you on the winch (it climbs for you); R releases early.',
          'W / S pitch (S pulls the nose up), A / D roll, Q / E rudder, Space airbrakes, Z / X trim, C cockpit view.',
          'Circle where the vario beeps and the birds wheel: over the dark roofs of the city is best. J bails out.',
        ];
        game.ui.dialog('Duty instructor', lines);
      } });
    }
    return {
      id: 'gliding_club',
      update(dt) {
        const cam = game.camera.position, d = Math.hypot(cam.x - SITE.centre[0], cam.z - SITE.centre[1]);
        const want = game.scene === game.worldScene && (d < NEAR || (game.gliding && game.gliding.local.phase && d < 3500));
        if (!want) { if (built && built.props.parent) { built.props.removeFromParent(); built.sock.group.removeFromParent(); } return; }
        if (!built) built = build();
        if (!built.props.parent) { scene.add(built.props); scene.add(built.sock.group); }
        // the winch's beacon flashes amber while a launch is on (anyone's: the record says so)
        const bc = built.props.userData.beacon, GL = game.gliding;
        if (bc) { const on = !!GL && (GL.local.phase === 'winch' || GL.gliders.some((G) => G.rec.mode === 6)), lit = on && (game.time.now() / 1000 * 1.4) % 1 < 0.45; bc.material.color.setHex(lit ? 0xffb020 : 0x3a2200); }
        const air = game.gliding && game.gliding.air;
        if (air) { const o = this._o || (this._o = [0, 0, 0]); air.at(SITE.windsock[0], 6, SITE.windsock[1], game.time.now(), game.time.hour, o); built.sock.set(o[0], o[2], dt, game.time.now() / 1000); }
      },
    };
  },
};
