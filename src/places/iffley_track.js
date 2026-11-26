// The Iffley Road running track, c. 2013 (the Roger Bannister running track since 2007) — see
// docs/research/landmarks_batch4.md.
//
//   preMap   the mapped grandstand w42138227 is skipped (rebuilt here as a small brick stand)
//   install  the six-lane 400 m track on the mapped football pitch's axis, its kerb and finish line (one LOD group with
//            aLayer 8, so it sorts over the park ground like a ground layer), the stand, the start board and the blue
//            plaque on Iffley Road, all in the batch-4 atlas draw (_b4_kit.js).
//   game     a timed mile: [E] at the board, four laps anticlockwise (lap checks: the whole lap must be run on the
//            track, quarter by quarter), your time on the HUD, your best kept in localStorage['gto-iffley-mile'].
//
// Test hooks: game.iffleyTrack = { sights, stats(), mile, best(), trackPos, onTrack }     tools/smoke_batch4.mjs
import { shared, addSite } from './_b4_kit.js';
import { TRACK, STAND, PLAQUE, START, RECORD, MASTS, fmt, trackPos, onTrack, tw, loopAt, buildSurface, buildStand, buildPlaque } from './_b4_track.js';
import { createRunners } from './_b4_life.js';

export const BEST_KEY = 'gto-iffley-mile';
export const sights = [
  { id: 'iffley-road-track', name: 'Iffley Road track', x: TRACK.c[0], z: TRACK.c[1] - 40, blurb: 'The University track where Roger Bannister ran the first mile in under four minutes, 3 minutes 59.4 seconds, on 6 May 1954. Renamed after him in 2007.' },
  { id: 'bannister-plaque', name: 'The four-minute-mile plaque', x: PLAQUE.x, z: PLAQUE.z, blurb: 'A blue plaque by the Iffley Road gate: here the first sub-four-minute mile was run on 6 May 1954.' },
];
const readBest = () => { try { const v = parseFloat(localStorage.getItem(BEST_KEY)); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; } };
const writeBest = (t) => { try { localStorage.setItem(BEST_KEY, String(t.toFixed(2))); } catch { /* private mode */ } };

/**
 * The mile's rules (pure, testable): feed it positions; it counts laps by crossing the finish line anticlockwise after
 * running every quarter of the lap on the track; leaving the track for more than 4 s, or getting into a vehicle, ends it.
 */
export function createMile() {
  const M = { state: 'idle', t: 0, laps: 0, quarters: 0, lastD: null, off: 0, count: 0, result: null };
  M.start = () => { Object.assign(M, { state: 'countdown', t: 0, laps: 0, quarters: 0, lastD: null, off: 0, count: 3, result: null }); };
  M.abort = (why) => { M.state = 'idle'; M.result = { dnf: why }; };
  /** -> event string or null ('go', 'lap', 'finish', 'dnf') */
  M.step = (dt, x, z, inVehicle) => {
    if (M.state === 'countdown') { M.count -= dt; if (M.count <= 0) { M.state = 'run'; M.t = 0; M.lastD = trackPos(x, z); M.quarters = 0; return 'go'; } return null; }
    if (M.state !== 'run') return null;
    M.t += dt;
    if (inVehicle) { M.abort('vehicle'); return 'dnf'; }
    if (!onTrack(x, z)) { M.off += dt; if (M.off > 4) { M.abort('off'); return 'dnf'; } return null; }
    M.off = 0;
    const d = trackPos(x, z), P = TRACK.P;
    M.quarters |= 1 << Math.min(3, Math.floor((d / P) * 4));
    const prev = M.lastD; M.lastD = d;
    if (prev !== null && prev > 0.8 * P && d < 0.2 * P) {
      if (M.quarters === 15) { M.laps++; M.quarters = 1; if (M.laps >= 4) { M.state = 'idle'; M.result = { time: M.t }; return 'finish'; } return 'lap'; }
      M.quarters = 1;
    }
    return null;
  };
  return M;
}

export default {
  id: 'iffley_track',
  preMap(game) { try { game.overrides.skip.add(STAND.id); } catch (e) { console.error('[iffley_track] preMap', e); } },

  install(game) {
    const K = shared(game), me = K.join('iffley_track'), col = game.worldCollider;
    const S = { err: false, hud: 0 };
    const mile = createMile();
    try {
      const [cx, cz] = TRACK.c;
      addSite(K, 'track:surface', [cx, 0, cz], 86, [90, 260, 900], [buildSurface(0), buildSurface(1), buildSurface(2)], { layer: 8, midArea: 0, farArea: 0 });
      addSite(K, 'track:stand', [1133.6, 4, 958], 28, [80, 220, 800], [buildStand(0), buildStand(1), buildStand(2)]);
      addSite(K, 'track:plaque', [PLAQUE.x, 1.4, PLAQUE.z], 2, [40, 90, 160], [buildPlaque(), buildPlaque(), buildPlaque()]);
      K.boxes.push([1070, 1260, 930, 1090], [PLAQUE.x - 5, PLAQUE.x + 5, PLAQUE.z - 5, PLAQUE.z + 5]);
      col.addPolygon(STAND.poly);
      for (const [x, z] of MASTS) { col.addCircle(x, z, 0.3); try { game.world.addLampGlow(x + (TRACK.c[0] - x) * 0.02, 13.9, z + (TRACK.c[1] - z) * 0.02); } catch { /* stub */ } }
      col.addBox(PLAQUE.x, PLAQUE.z, 0.95, 0.95, Math.atan2(PLAQUE.n[0], PLAQUE.n[1]));
      game.interact.add({
        pos: [START.x, START.z], radius: 2.4,
        label: () => (mile.state === 'idle' ? 'Run a timed mile (four laps)' : 'Give up the mile'),
        onUse: () => {
          if (mile.state !== 'idle') { mile.abort('quit'); end('You stop and put your hands on your knees.'); return; }
          if (game.player.vehicle) { game.ui.toast('On foot, please. It is a running track.', 3); return; }
          mile.start(); game.ui.toast('On your marks… four laps, anticlockwise, the infield on your left. Bannister did it in ' + RECORD.label + '.', 4);
        },
      });
    } catch (e) { console.error('[iffley_track] build', e); } finally { K.joined(me); }

    // joggers doing laps by day (visual pass; outer lanes, so a timed mile in lane 1 is not in their way)
    const runners = createRunners(game, (d, i) => loopAt(d, 1.22 * (3 + i)), TRACK.P, { n: 3, c: TRACK.c, near: 170 });
    function end(msg) { try { game.ui.objective(null); if (msg) game.ui.toast(msg, 6); } catch { /* */ } }
    function tick(dt) {
      K.tick(me);
      runners.tick(dt);
      if (mile.state === 'idle') return;
      const p = game.player;
      const ev = p.place === 'world' ? mile.step(dt, p.pos.x, p.pos.z, !!p.vehicle) : (mile.abort('left'), 'dnf');
      if (ev === 'go') { try { game.ui.toast('GO!', 1.5); } catch { /* */ } }
      else if (ev === 'lap') { try { game.ui.toast(`Lap ${mile.laps}: ${fmt(mile.t)}`, 2.5); } catch { /* */ } }
      else if (ev === 'finish') {
        const t = mile.result.time, best = readBest(), pb = best === null || t < best;
        if (pb) writeBest(t);
        const vs = t < RECORD.secs ? `Under four minutes! (Bannister: ${RECORD.label}, without a games console.)` : `Bannister ran ${RECORD.label} here in 1954.`;
        end(`Mile: ${fmt(t)}${pb ? ' — a personal best!' : ` (best ${fmt(best)})`} ${vs}`);
        return;
      } else if (ev === 'dnf') { end(mile.result.dnf === 'off' ? 'You left the track. Did not finish.' : mile.result.dnf === 'vehicle' ? 'Wheels are not allowed. Did not finish.' : 'Did not finish.'); return; }
      S.hud -= dt;
      if (S.hud <= 0) { S.hud = 0.1; try { game.ui.objective(mile.state === 'countdown' ? `Timed mile: ${Math.ceil(mile.count)}…` : `Timed mile · lap ${Math.min(4, mile.laps + 1)}/4 · ${fmt(mile.t)}${readBest() ? ' · best ' + fmt(readBest()) : ''}`); } catch { /* */ } }
    }
    game.iffleyTrack = {
      sights, mile, best: readBest, trackPos, onTrack, start: START, track: TRACK, tw,
      stats() { return { runners: runners.stats(), mile: { state: mile.state, laps: mile.laps, t: +mile.t.toFixed(2) }, levels: K.lod.groups.filter((g) => /^track:/.test(g.name)).map((g) => g.name + ':' + g.level), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^track:/.test(k)).map(([k, v]) => [k, v.tris])) }; },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[iffley_track]', e); } } } };
  },
};
