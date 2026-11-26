// Fingerposts: black cast-iron pedestrian signposts at the main street corners (Oxford really has them), each finger
// pointing down the street you would walk and giving the walking time. The game has no map, no minimap and no waypoint
// arrows on purpose (core/features.js): this is how you find the station, the river or the gliding club.
// Pure part (places, routing, geometry): _fingerpost_logic.js. Cost: ONE draw (a few thousand triangles, one 2048 x 1024
// canvas atlas), hidden unless a post is within 240 m of the player; a solid 9 cm circle per post. Built a few
// milliseconds at a time over the first seconds of play (one shortest-path pass per post over the walkers' graph).
// Nothing on the network: positions and fingers are a function of the map, the same for everyone.
// game.fingerposts = { posts: [{ id, x, z, fingers: [{ key, name, mins, bx, bz }] }], ready, stats() }
import * as THREE from 'three';
import { repaintable } from '../world/_tex_keep.js';
import { DESTS, POSTS, dijkstra, firstLeg, chooseFingers, buildGeometry, minutes } from './_fingerpost_logic.js';

const ROW_W = 384, ROW_H = 56, AW = 2048, AH = 1024, COLS = 5, PER = 17, SHOW_R = 240;   // 85 text rows + a row of paint

export default {
  id: 'fingerposts',
  install(game) {
    const S = { posts: [], ready: false, mesh: null, i: 0, stage: 0, t: 0.5, dn: null, vis: 0 };
    game.fingerposts = { get posts() { return S.posts; }, get ready() { return S.ready; }, stats: () => ({ posts: S.posts.length, fingers: S.posts.reduce((n, p) => n + p.fingers.length, 0), rows: S.rows | 0, draws: S.mesh && S.mesh.visible ? 1 : 0 }) };

    /** the nearest clear bit of pavement to a wanted corner: off the carriageway, outside buildings, dry, nothing in the way */
    function place(x, z) {
      const V = game.vehicles && game.vehicles._sys, col = game.worldCollider;
      const ok = (px, pz) => {
        try {
          if (V && V.onCarriage && V.onCarriage(px, pz, 0.7)) return false;
          if (V && V.okSpot) return V.okSpot(px, pz, 0.45);
          return !col || col.isFree(px, pz, 0.45);
        } catch { return false; }
      };
      for (let r = 0; r <= 26; r += 1.25) {
        const n = r ? Math.ceil((r * 6.283) / 1.6) : 1;
        for (let k = 0; k < n; k++) { const a = (k / n) * 6.283 + r * 0.7, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (ok(px, pz)) return [px, pz]; }
      }
      return null;
    }

    function plan(spec) {
      const P = game.pedestrians, G = P && P.graph; if (!G || !P._sys) return null;
      const at = place(spec[1], spec[2]); if (!at) return null;
      const src = P._sys.nearestNode(at[0], at[1], 45); if (src < 0) return null;
      if (!S.dn) S.dn = DESTS.map((d) => P._sys.nearestNode(d[2], d[3], 160));
      const sp = dijkstra(G, src), cands = [];
      DESTS.forEach((d, i) => {
        const b = S.dn[i]; if (b < 0 || !Number.isFinite(sp.dist[b])) return;
        const leg = firstLeg(G, sp, b, 45), dx = leg[0] - at[0], dz = leg[1] - at[1], L = Math.hypot(dx, dz);
        if (L < 4) return;
        cands.push({ key: d[0], name: d[1], d: sp.dist[b], bx: dx / L, bz: dz / L, major: d[4] | 0 });
      });
      const fingers = chooseFingers(cands).map((c) => ({ key: c.key, name: c.name, mins: minutes(c.d), bx: c.bx, bz: c.bz, row: 0 }));
      if (!fingers.length) return null;
      return { id: spec[0], x: at[0], z: at[1], y: game.world && game.world.groundHeight ? game.world.groundHeight(at[0], at[1]) : 0, fingers };
    }

    function build() {
      // one atlas row per distinct text (the same place at the same walking time shares a row)
      const texts = new Map(); let row = 0;
      for (const p of S.posts) for (const f of p.fingers) { const k = f.name + '|' + f.mins; if (!texts.has(k)) texts.set(k, row++); f.row = texts.get(k); }
      for (const p of S.posts) p.fingers = p.fingers.filter((f) => f.row < COLS * PER);
      S.rows = Math.min(row, COLS * PER);
      const uvRow = (r) => { const c = Math.floor(r / PER), q = r % PER; return [(c * ROW_W + 2) / AW, 1 - ((q + 1) * ROW_H - 2) / AH, ((c + 1) * ROW_W - 2) / AW, 1 - (q * ROW_H + 2) / AH]; };
      const last = 1 - (PER * ROW_H + ROW_H / 2) / AH, uvBlack = [(ROW_W / 2) / AW, last], uvGold = [(ROW_W * 1.5) / AW, last];
      const g = buildGeometry(S.posts, uvRow, uvBlack, uvGold);
      for (const p of S.posts) { try { game.worldCollider.addCircle(p.x, p.z, 0.09, { tag: 'fingerpost' }); } catch { /* */ } }
      if (typeof document === 'undefined') return;                // headless tools: the plan and the colliders are enough
      // (the sheet as a function: painted again if the card ever needs it again, so its canvas goes once it is there — world/_tex_keep.js)
      const paintSheet = () => {
      const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
      const c = cv.getContext('2d'); if (!c) return null;
      c.fillStyle = '#16181a'; c.fillRect(0, 0, AW, AH);
      c.fillStyle = '#c9a54a'; c.fillRect(ROW_W, PER * ROW_H, ROW_W, AH - PER * ROW_H);
      c.textBaseline = 'middle';
      const drawn = new Set();
      for (const p of S.posts) for (const f of p.fingers) {
        if (drawn.has(f.row)) continue; drawn.add(f.row);
        const col = Math.floor(f.row / PER), q = f.row % PER, x0 = col * ROW_W, y0 = q * ROW_H;
        c.strokeStyle = '#c9a54a'; c.lineWidth = 2.5; c.strokeRect(x0 + 5, y0 + 6, ROW_W - 10, ROW_H - 12);
        const t = `${f.mins} min`;
        c.font = '600 22px Georgia, "Times New Roman", serif'; c.fillStyle = '#e9cf86'; c.textAlign = 'right';
        c.fillText(t, x0 + ROW_W - 14, y0 + ROW_H / 2 + 1);
        const tw = c.measureText(t).width;
        let px = 28; c.fillStyle = '#f6f3ea'; c.textAlign = 'left';
        do { c.font = `600 ${px}px Georgia, "Times New Roman", serif`; px--; } while (px > 15 && c.measureText(f.name).width > ROW_W - 40 - tw);
        c.fillText(f.name, x0 + 14, y0 + ROW_H / 2 + 1);
      }
      return cv; };
      const cv = paintSheet(); if (!cv) return;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; repaintable(tex, paintSheet, 'fingerposts');
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setIndex(g.idx);
      // (a little self-light so the lettering still reads under the street lamps at night)
      const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 });
      const m = new THREE.Mesh(geo, mat);
      m.name = 'fingerposts'; m.userData.owner = 'fingerposts'; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.visible = false; m.matrixAutoUpdate = false;
      game.worldScene.add(m); S.mesh = m;
    }

    return {
      update(dt) {
        if (S.stage === 2) {
          if (!S.mesh || (S.vis -= dt) > 0) return;
          S.vis = 0.5;
          const p = game.player, q = p.place === 'world' ? p.pos : p.worldPos; let near = false;
          if (q) for (const o of S.posts) if (Math.abs(o.x - q.x) < SHOW_R && Math.abs(o.z - q.z) < SHOW_R) { near = true; break; }
          S.mesh.visible = near;
          return;
        }
        if ((S.t -= dt) > 0) return;
        S.t = 0.12;                                                // one post (one ~10 ms shortest-path pass) at a time
        try {
          if (S.stage === 0) {
            if (!game.pedestrians || !game.pedestrians.graph || !game.vehicles) { S.t = 1; return; }
            if (S.i < POSTS.length) { const p = plan(POSTS[S.i++]); if (p) S.posts.push(p); return; }
            S.stage = 1;
          }
          if (S.stage === 1) { build(); S.ready = true; S.stage = 2; }
        } catch (e) { console.error('[fingerposts]', e); S.stage = 2; }
      },
    };
  },
};
