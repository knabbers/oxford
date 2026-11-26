// Children at play and animals at large (2026-11-21): the small scenes of the parks and colleges that are not walkers
// on the pavement graph — a dog off the lead fetching a ball, a kite, two children and a football, a child on a
// scooter, a family feeding the ducks, cats on garden walls and in quads, the college tortoise on its lawn.
//
// THE SAME FOR EVERY PLAYER WITHOUT BEING SENT: where the scenes are is a function of the map (sites found once, by a
// seeded search of the park polygons and the mapped walls), whether one is out today a function of the site and the
// game day, and what everybody in it is doing a function of the shared clock (game.time.now()) — as the college porters
// and the scripted wanderers are (pedestrians.js). Only what reacts to somebody (a cat slinking off, a tortoise drawing
// its head in, anyone stepping out of a vehicle's way) is local, and it reacts to every player alike.
//
// People are ordinary scripted pedestrians (game.pedestrians.spawnAt: in the list, drawn, LOD'd and spoken for like any
// other) under a controller of ours; the children follow every rule of systems/_ped_child.js (each has its adult as
// p.leader and stays within reach of them; out only in the hours children are out; never knocked: p.child). Animals are
// registered each frame with pedestrians.animals, so nothing can hit one (systems/_ped_protect.js) and the traffic
// stops for them. Places may add a scene of their own by pushing onto game.townScenes (see _addHooked): Worcester's
// lake does, for the family feeding its ducks.
//
// Cost: nothing but a distance test per site twice a second until a site is within 150 m; then its handful of figures.
import * as THREE from 'three';
import { pointInPoly } from '../core/collision.js';
import { DAY_MS } from '../core/time.js';
import { childLook, guardLook, mayAppear, mayBeOut, schoolTrip, CHILD_TO, CHILD_LINES } from './_ped_child.js';
import { createAnimal, bark, scooterRattle } from './_ped_pets.js';
import { createScooter, createKite, createBall } from './_ped_child_kit.js';

const TAU = Math.PI * 2, NEAR = 150, FAR = 185;
const hh = (a, b, c) => { let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca77) ^ Math.imul((c | 0) + 0x165667b1, 0xc2b2ae3d)) >>> 0; h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const OWNER_LINES = ['Fetch! Go on!', 'Drop it. Drop. Good girl!', 'Bring it here!', 'Good boy! Again?', "That's not your ball!"];
const PARENT_LINES = ['Not too far!', 'Lovely. Well done!', 'Five more minutes.', 'Mind the path!', 'Shall we feed the ducks after?', 'Hold it tight!'];

// which scenes each park has room for (kinds in order of preference; a site that finds no room is left out)
const PARKS = [
  { name: 'University Parks', kinds: ['fetch', 'ball', 'scooter', 'kite', 'fetch', 'family'], minArea: 60000 },
  { name: 'South Park', kinds: ['kite', 'fetch', 'ball', 'kite', 'fetch'] },
  { name: 'Christ Church Meadow', kinds: ['fetch', 'scooter', 'ball', 'family'] },
];
// Port Meadow lies outside the map's own areas (places/_pm_site.js): the open grass east of the river
const PORT_MEADOW = { name: 'Port Meadow', kinds: ['fetch', 'kite', 'fetch'], box: [-1080, -940, -1420, -900] };
// the college tortoises: Corpus Christi's (the Tortoise Fair each May is real, and the tortoises live in the college
// garden) and Worcester's (the college has kept tortoises on its lawns; which lawn is a GUESS — the Provost's lawn by
// the main quad is used). Real tortoises sleep from about November to March; here they are out on any dry day, so that
// there is something to find whenever the game is played.
const TORTOISES = [{ name: 'Corpus Christi', x: 514, z: 379, r: 5 }, { name: 'Worcester', x: -278, z: 14, r: 7 }];

export class TownScenes {
  constructor(game, peds) {
    this.game = game; this.peds = peds; this.sites = []; this.ready = false; this._chk = 0; this._hooked = 0;
    this.stats = { sites: 0, cats: 0, built: 0, live: 0 };
    this.all = false;          // (for looking and for tests: every scene out whatever the day - game.pedestrians.scenes.all = true)
    this.group = new THREE.Group(); this.group.name = 'town-scenes';
  }
  // ------------------------------------------------------------------------------------------------ sites
  _ok(x, z, r) {
    const P = this.peds, col = this.game.worldCollider;
    if (P.wet(x, z) || (col.isWet && col.isWet(x, z)) || !col.isFree(x, z, Math.min(r, 1.2)) || P.road(x, z, 14)) return false;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; if (P.wet(px, pz) || (col.isWet && col.isWet(px, pz)) || col.raycast(x, z, px, pz) !== null) return false; }
    return true;
  }
  _init() {
    this.ready = true;
    const g = this.game, map = g.map, S = this.sites;
    if (!map || !map.areas || !g.worldCollider) return;
    g.worldScene.add(this.group);
    const need = { fetch: 13, kite: 6, ball: 6, scooter: 8, family: 4 };
    const place = (name, kinds, sample, inside) => {
      kinds.forEach((kind, i) => {
        const seed = (hh(name.length * 131 + name.charCodeAt(0), i, 7) * 1e9) | 0;
        if (kind === 'scooter') {
          // a scooter keeps to a path: a straight stretch of one, well inside the park and away from water and roads
          const G = this.peds.graph, col = g.worldCollider, n0 = Math.floor(hh(seed, 0, 3) * G.count);
          for (let q = 0; q < G.count; q++) {
            const a = (n0 + q * 7919) % G.count, ax = G.X[a], az = G.Z[a];
            if (!inside(ax, az)) continue;
            for (let e = G.start[a]; e < G.start[a + 1]; e++) {
              // (the graph's nodes are a few metres apart: follow the path on from a, straight, until 14 m of it are behind)
              const n1 = G.nbr[e]; let dx0 = G.X[n1] - ax, dz0 = G.Z[n1] - az; const l0 = Math.hypot(dx0, dz0) || 1; dx0 /= l0; dz0 /= l0;
              let cur = n1, prev = a, okc = true;
              for (let st = 0; st < 24 && okc && Math.hypot(G.X[cur] - ax, G.Z[cur] - az) < 14; st++) {
                let best = -1, bd = 0.94;
                for (let k = G.start[cur]; k < G.start[cur + 1]; k++) { const m = G.nbr[k]; if (m === prev) continue; const ex = G.X[m] - G.X[cur], ez = G.Z[m] - G.Z[cur], el = Math.hypot(ex, ez) || 1, dt0 = (ex * dx0 + ez * dz0) / el; if (dt0 > bd) { bd = dt0; best = m; } }
                if (best < 0) okc = false; else { prev = cur; cur = best; }
              }
              const b = cur, bx = G.X[b], bz = G.Z[b], len = Math.hypot(bx - ax, bz - az);
              if (!okc || len < 13 || len > 60 || !inside(bx, bz)) continue;
              const mx = (ax + bx) / 2, mz = (az + bz) / 2, ux = (bx - ax) / len, uz = (bz - az) / len, half = Math.min(len / 2 - 1, 6.5);
              let ok = !this.peds.road(mx, mz, 12) && !S.some((w) => Math.hypot(w.x - mx, w.z - mz) < 30);
              for (let t = -half - 1; t <= half + 1 && ok; t += 1.5) for (const w of [-2.6, 0, 2.6]) { const x = mx + ux * t + uz * w, z = mz + uz * t - ux * w; if (this.peds.wet(x, z) || (col.isWet && col.isWet(x, z)) || !col.isFree(x, z, 0.3)) { ok = false; break; } }
              if (!ok) continue;
              S.push({ kind, x: mx, z: mz, seed, park: name, on: false, kids: true, path: { ux, uz, half } }); return;
            }
          }
          return;
        }
        for (let k = 0; k < 60; k++) {
          const [x, z] = sample(hh(seed, k, 1), hh(seed, k, 2));
          if (!inside(x, z) || !this._ok(x, z, need[kind])) continue;
          if (S.some((q) => Math.hypot(q.x - x, q.z - z) < 30)) continue;
          S.push({ kind, x, z, seed, park: name, on: false, kids: kind !== 'fetch' }); return;
        }
      });
    };
    for (const P of PARKS) {
      const polys = map.areas.filter((a) => a.name === P.name && a.poly && a.poly.length > 3); if (!polys.length) continue;
      // (the biggest polygon of the name: University Parks is mapped in three pieces)
      let best = null, ba = 0, bb = null;
      for (const a of polys) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of a.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } const ar = (x1 - x0) * (z1 - z0); if (ar > ba) { ba = ar; best = a; bb = [x0, x1, z0, z1]; } }
      place(P.name, P.kinds, (u, v) => [bb[0] + u * (bb[1] - bb[0]), bb[2] + v * (bb[3] - bb[2])], (x, z) => pointInPoly(x, z, best.poly));
    }
    { const b = PORT_MEADOW.box; place(PORT_MEADOW.name, PORT_MEADOW.kinds, (u, v) => [b[0] + u * (b[1] - b[0]), b[2] + v * (b[3] - b[2])], () => true); }
    for (const T of TORTOISES) { const col = g.worldCollider; if (col.isFree(T.x, T.z, 0.3) && !this.peds.wet(T.x, T.z)) S.push({ kind: 'tortoise', x: T.x, z: T.z, r: T.r, seed: (T.x * 31 + T.z) | 0, park: T.name, on: false, kids: false }); }
    // a school party gathered outside each museum (the map's museums), on school days between the bells: the teacher
    // talking, the class in its pairs in front of them, another grown-up behind
    // (2026-11-22: the museums schools really go to. The map's own 'museum' points are the Museum of Oxford - kept - and
    // two small collections no class visits (a college picture gallery, the Music Faculty's instruments - dropped); the
    // University Museum of Natural History and the Ashmolean are buildings, not points: places/natural_history_museum.js
    // (way w25999883, its front to the lawn on Parks Road) and places/ashmolean.js (relation r1337584, its front to
    // Beaumont Street). The party gathers on clear ground in front of the entrance.)
    const SCHOOL_MUSEUMS = [];
    for (const p of map.pois || []) if (p.kind === 'museum' && /Museum of Oxford/i.test(p.name || '')) SCHOOL_MUSEUMS.push({ name: p.name, x: p.p[0], z: p.p[1], fx: 0, fz: 0 });
    for (const [id, name, fx, fz] of [['w25999883', 'Museum of Natural History', -1, 0], ['r1337584', 'Ashmolean Museum', 0, 1]]) {
      const b = (map.buildings || []).find((q) => q.id === id); if (!b || !b.c) continue;
      let ext = 0; for (const [x, z] of b.poly) ext = Math.max(ext, (x - b.c[0]) * fx + (z - b.c[1]) * fz);      // (how far the front is from the middle)
      SCHOOL_MUSEUMS.push({ name, x: b.c[0] + fx * ext, z: b.c[1] + fz * ext, fx, fz });
    }
    for (const M of SCHOOL_MUSEUMS) {
      const sd = ((M.x * 53 + M.z * 17) | 0) ^ 0x77;
      for (let k = 0; k < 120; k++) {
        let x, z;
        if (M.fx || M.fz) { const out = 6 + hh(sd, k, 92) * 30, lat = (hh(sd, k, 91) - 0.5) * 36; x = M.x + M.fx * out + M.fz * lat; z = M.z + M.fz * out - M.fx * lat; }
        else { const a = hh(sd, k, 91) * TAU, r = 7 + hh(sd, k, 92) * 22; x = M.x + Math.sin(a) * r; z = M.z + Math.cos(a) * r; }
        if (!this._ok(x, z, 4.5) || this.peds.road(x, z, 5)) continue;
        S.push({ kind: 'party', x, z, h: Math.atan2(M.x - x, M.z - z), seed: sd, park: M.name || 'museum', on: false, kids: true, school: true }); break;
      }
    }
    // cats: on the mapped garden and college walls (a wall a cat can sit on: 1.1 - 2.6 m high, a stretch at least 4 m
    // long), about one wall in forty, by the wall's own id — so the same cats on the same walls for everyone, always
    let cats = 0;
    for (const b of map.barriers || []) {
      if (b.kind !== 'wall' || !(b.h >= 1.1 && b.h <= 2.6) || !b.pts || b.pts.length < 2) continue;
      let id = 0; const sid = String(b.id || ''); for (let i = 0; i < sid.length; i++) id = (Math.imul(id, 31) + sid.charCodeAt(i)) | 0;
      if (hh(id, 3, 9) > 0.026) continue;
      const k = Math.floor(hh(id, 4, 9) * (b.pts.length - 1)), A = b.pts[k], B = b.pts[k + 1], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (len < 4) continue;
      const u = 0.3 + hh(id, 5, 9) * 0.4, x = A[0] + (B[0] - A[0]) * u, z = A[1] + (B[1] - A[1]) * u;
      if (this.peds.wet(x, z)) continue;
      S.push({ kind: 'cat', x, z, seed: id, wall: { ax: A[0], az: A[1], bx: B[0], bz: B[1], len, u, h: b.h }, park: 'wall', on: false, kids: false }); cats++;
    }
    // …and one on the grass of a quad or a college garden here and there (the college cat)
    for (const a of map.areas) {
      if (!(a.kind === 'grass' || a.kind === 'garden') || !a.poly || a.poly.length < 4) continue;
      let cx = 0, cz = 0; for (const [x, z] of a.poly) { cx += x; cz += z; } cx /= a.poly.length; cz /= a.poly.length;
      const id = (cx * 73 + cz * 151) | 0; if (hh(id, 6, 9) > 0.035) continue;
      if (!(this.peds.zone(cx, cz) & 64) || !pointInPoly(cx, cz, a.poly) || !g.worldCollider.isFree(cx, cz, 0.4) || this.peds.wet(cx, cz)) continue;      // (Z_COLL: inside a college)
      S.push({ kind: 'cat', x: cx, z: cz, seed: id, wall: null, park: 'quad', on: false, kids: false }); cats++;
    }
    this.stats.sites = S.length; this.stats.cats = cats;
  }
  /** scenes that places ask for: game.townScenes.push({ kind: 'ducks', x, z, h, feed() }) — a parent and a child at the
   *  water's edge at (x, z) facing h; feed() is called when the child throws (the place's own birds come for it) */
  _addHooked() {
    const H = this.game.townScenes; if (!H) return;
    for (; this._hooked < H.length; this._hooked++) { const o = H[this._hooked]; if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.z)) continue; this.sites.push({ kind: o.kind || 'ducks', x: o.x, z: o.z, h: o.h || 0, feed: o.feed || null, seed: ((o.x * 97 + o.z * 13) | 0) ^ 0x5bd1, park: o.name || 'hook', on: false, kids: true }); this.stats.sites++; }
  }

  // ------------------------------------------------------------------------------------------------ frame
  update(dt, pp, inWorld) {
    const g = this.game, P = this.peds;
    if (!this.ready) { if (!g.world || !P.graph || !P.graph.count) return; this._init(); }
    if (g.townScenes && this._hooked < g.townScenes.length) this._addHooked();
    const h = P._hour, now = g.time && g.time.now ? g.time.now() : 0, t = now / 1000, day = Math.floor(now / DAY_MS);
    if ((this._chk -= dt) <= 0) {
      this._chk = 0.5;
      const wx = g.weather, wet = !!(wx && wx.crowd < 0.75);
      for (const s of this.sites) {
        const d = P._pd(s.x, s.z, pp);
        // out today? children: by day, fine weather, three days in four; dogs: daylight; cats: any time but the small
        // hours (fewer in the rain); a tortoise: the warm middle of a dry day
        let want = d < (s.on ? FAR : NEAR) && inWorld !== false;
        if (want) {
          if (s.school) want = schoolTrip(h, now) && (this.all || hh(s.seed, day, 14) < 0.6);
          else if (s.kids) want = (s.on ? mayBeOut(h) && (h < CHILD_TO || d < 38) : mayAppear(h)) && !wet && (this.all || hh(s.seed, day, 11) < 0.75);
          else if (s.kind === 'fetch') want = h >= 7 && h < 20 && !wet && (this.all || hh(s.seed, day, 11) < 0.8);
          else if (s.kind === 'tortoise') want = h >= 9.5 && h < 17 && !wet;
          else want = (h >= 5 || h < 1) && !(wet && hh(s.seed, day, 12) < 0.6) && (this.all || hh(s.seed, Math.floor(now / 3.6e6), 13) < 0.7);
        }
        // (children are never left out late even if somebody is standing there)
        if (s.on && s.kids && !mayBeOut(h)) want = false;
        if (want && !s.on) this._build(s, t); else if (!want && s.on) this._drop(s);
      }
    }
    let live = 0;
    for (const s of this.sites) if (s.on) { live++; this._tick(s, t, dt, pp); }
    this.stats.live = live;
  }
  _person(s, x, z, role, seed, heading, lines) {
    const P = this.peds, look = role === 'parent' ? guardLook('parent', seed) : role === 'owner' ? null : childLook(role, seed, seed % 5);
    let p;
    if (role === 'owner') { const L = guardLook('parent', seed); L.jacket = [0x3e4230, 0x1c2436, 0x5a4636, 0x2a3a2a][seed % 4]; L.jacketLen = 'hip'; L.shoeStyle = 'boot'; delete L.prop; p = P.spawnAt(x, z, L, { role: 'dogwalker', heading, lines, knockable: true, label: '' }); }
    else p = P.spawnAt(x, z, look, { role, heading, lines: lines || (role === 'parent' ? PARENT_LINES : CHILD_LINES[role]), knockable: role === 'parent' });
    p.state = 'ctl'; p.ctl = this._hold; p.static = true; p.bx = x; p.bz = z; p.scene_ = s;
    p.character.reach = 0; p.character.pushing = false; p.handSide = 0;      // (nobody here is hand in hand)
    s.people.push(p);
    return p;
  }
  _build(s, t) {
    const g = this.game, P = this.peds, sd = s.seed >>> 0;
    s.on = true; s.people = []; s.objs = []; s.animals = []; s.t0 = t; this.stats.built++;
    const add = (o) => { this.group.add(o); s.objs.push(o); return o; };
    const beast = (kind, x, z, r, opts) => { const a = createAnimal(kind, opts); this.group.add(a.group); const st = { a, x, z, bx: x, bz: z, h: 0, r, kind, gone: false, hideT: 0, mode: 0, y: 0, onAside: null }; s.animals.push(st); return st; };
    const th = hh(sd, 1, 21) * TAU;
    try {
      if (s.kind === 'fetch') {
        s.owner = this._person(s, s.x, s.z, 'owner', sd, th, OWNER_LINES);
        s.dog = beast('dog', s.x + 1, s.z + 1, 0.24, { seed: sd ^ 0x9e37 });
        s.ball = add(createBall(sd)); s.ball.scale.setScalar(0.32);
        // where the ball may be thrown: the directions with a clear run
        s.throws = [];
        for (let k = 0; k < 10; k++) { const a = th + (k / 10) * TAU, r = 9 + hh(sd, k, 22) * 4, x = s.x + Math.sin(a) * r, z = s.z + Math.cos(a) * r; if (!P.wet(x, z) && !P.road(x, z, 8) && g.worldCollider.raycast(s.x, s.z, x, z) === null && !P._wetLine(s.x, s.z, x, z)) s.throws.push([x, z, a]); }
        if (!s.throws.length) s.throws.push([s.x + Math.sin(th) * 3, s.z + Math.cos(th) * 3, th]);
      } else if (s.kind === 'tortoise') {
        s.tort = beast('tortoise', s.x, s.z, 0.17, { seed: sd });
      } else if (s.kind === 'cat') {
        s.cat = beast('cat', s.x, s.z, 0.14, { seed: sd });
        const gh = g.world && g.world.groundHeight ? g.world.groundHeight(s.x, s.z) : 0;
        s.cat.y = (gh === gh ? gh : 0) + (s.wall ? s.wall.h + 0.02 : 0); s.cat.h = s.wall ? Math.atan2(s.wall.bx - s.wall.ax, s.wall.bz - s.wall.az) + (hh(sd, 2, 23) < 0.5 ? Math.PI / 2 : -Math.PI / 2) : th;
        s.cat.pose = hh(sd, 3, 23) < 0.5 ? 'sit' : 'loaf'; s.cat.u = 0;
      } else {
        // a family: the grown-up a little to one side, the children doing what the scene is
        const px = s.x - Math.sin(th) * 2.4, pz = s.z - Math.cos(th) * 2.4;
        if (s.kind === 'party') {
          // the teacher with their back to the museum, the class facing them two by two
          const fx = Math.sin(s.h), fz = Math.cos(s.h), lx = fz, lz = -fx;
          s.parent = this._person(s, s.x + fx * 1.6, s.z + fz * 1.6, 'teacher', sd, s.h + Math.PI);
          s.pupils = []; const n = 6 + 2 * Math.floor(hh(sd, 5, 93) * 3);
          for (let i = 0; i < n; i++) { const row = Math.floor(i / 2), sx = (i % 2 ? 0.36 : -0.36) + (row % 2 ? 0.75 : -0.75) * (n > 6 ? 1 : 0.6); s.pupils.push(this._person(s, s.x + lx * sx - fx * (row >> (n > 6 ? 1 : 0)) * 0.9, s.z + lz * sx - fz * (row >> (n > 6 ? 1 : 0)) * 0.9, 'pupil', (sd + 31 * (i + 1)) * 5 + (sd % 5), s.h)); }
          this._person(s, s.x - fx * 3.4 + lx * 1.2, s.z - fz * 3.4 + lz * 1.2, 'teacher', sd + 3, s.h);
        } else if (s.kind === 'ducks') { s.parent = this._person(s, s.x - Math.cos(s.h) * 0.7 - Math.sin(s.h) * 0.3, s.z + Math.sin(s.h) * 0.7 - Math.cos(s.h) * 0.3, 'parent', sd, s.h); s.kid = this._person(s, s.x, s.z, hh(sd, 4, 24) < 0.4 ? 'toddler' : 'child', sd + 7, s.h); }
        else {
          if (s.path) s.parent = this._person(s, s.x + s.path.uz * 2.3, s.z - s.path.ux * 2.3, 'parent', sd, th);
          else s.parent = this._person(s, px, pz, 'parent', sd, th);
          s.kid = this._person(s, s.x, s.z, s.kind === 'family' && hh(sd, 4, 24) < 0.5 ? 'toddler' : 'child', sd + 7, th);
          if (s.kind === 'ball') { s.kid2 = this._person(s, s.x + Math.sin(th + 1.57) * 5, s.z + Math.cos(th + 1.57) * 5, 'child', sd + 13, th - 1.57); s.ball = add(createBall(sd)); }
          if (s.kind === 'kite') { s.kite = add(createKite(sd)); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)); s.line = add(new THREE.Line(geo, P.leashMat)); s.line.frustumCulled = false; }
          if (s.kind === 'scooter') { s.scoot = add(createScooter(sd, Math.round((0.52 * (s.kid.character.dims.top || 1.2) + 0.1) * 20) / 20)); }
        }
        for (const q of s.people) if (q.child) q.leader = s.parent;
        for (const q of s.people) if (q.role === 'teacher') { q.lines = ['Who can tell me what a dodo was?', 'Stay together inside, please.', 'Worksheets out. Pencils only.', 'Indoor voices, Year Four.', 'We are guests here. Hands to ourselves.']; }
      }
    } catch (e) { console.warn('[town-scenes] ' + s.kind + ': ' + e.message); this._drop(s); s.dead = true; }
  }
  _drop(s) {
    s.on = false;
    for (const p of s.people || []) { p.leader = null; p.ctl = null; if (p.active) this.peds.remove(p); }
    for (const o of s.objs || []) { o.removeFromParent(); if (o.isLine && o.geometry) o.geometry.dispose(); }
    for (const st of s.animals || []) { st.gone = true; st.a.group.removeFromParent(); st.a.dispose(); }
    s.people = []; s.objs = []; s.animals = []; s.pupils = null; s.owner = s.dog = s.ball = s.kid = s.kid2 = s.parent = s.kite = s.line = s.scoot = s.cat = s.tort = null;
  }
  /** the controller every scene person is under: it only keeps them (their place is set by _tick) */
  _hold() { return true; }
  /** put a scene person where the scene has them (bx, bz), keeping whatever they have been moved aside by (a bump from
   *  the player, stepping out of a vehicle's way), which eases off */
  _put(p, x, z, heading, speed, dt) {
    let dx = p.x - p.bx, dz = p.z - p.bz; const d = Math.hypot(dx, dz);
    if (d > 0.01) { const k = Math.max(0, 1 - dt * (p.asideT > 0 ? 0 : 0.9)); dx *= k; dz *= k; } else { dx = 0; dz = 0; }
    if (p.asideT > 0) p.asideT -= dt;
    p.bx = x; p.bz = z; p.x = x + dx; p.z = z + dz; p.speed = speed;
    if (heading !== null) p.heading += wrapA(heading - p.heading) * Math.min(1, dt * 7);
  }
  _putBeast(st, x, z, heading, dt, speed, y) {
    let dx = st.x - st.bx, dz = st.z - st.bz; const k = Math.max(0, 1 - dt * 0.9); dx *= k; dz *= k;
    st.bx = x; st.bz = z; st.x = x + dx; st.z = z + dz; st.h += wrapA(heading - st.h) * Math.min(1, dt * 8);
    const a = st.a; a.group.position.set(st.x, y, st.z); a.group.rotation.y = st.h; a.update(dt, speed);
  }
  _gy(x, z) { const g = this.game, h = g.world && g.world.groundHeight ? g.world.groundHeight(x, z) : 0; return h === h ? h : 0; }
  _nearest(x, z, pp) {
    // the nearest player (anyone's): { d, x, z }
    const g = this.game, N = this._np || (this._np = { d: 0, x: 0, z: 0 });
    N.x = pp.x; N.z = pp.z; N.d = g.player.place === 'world' || g.player.worldPos ? Math.hypot(pp.x - x, pp.z - z) : 1e9;
    const S = this.peds._S, R = S && S.core.remotes;
    if (R) for (let i = 0; i < R.length; i++) { const q = R[i], d = Math.hypot(q.x - x, q.z - z); if (d < N.d) { N.d = d; N.x = q.x; N.z = q.z; } }
    return N;
  }
  _tick(s, t, dt, pp) {
    const P = this.peds, g = this.game, sd = s.seed >>> 0;
    if (s.kind === 'fetch') {
      // one throw every T seconds, all of it a function of the clock: wind up and throw; the ball flies; the dog is away
      // after it, noses it, brings it back and sits; a word; again
      const T = 15, k = Math.floor((t + hh(sd, 0, 31) * T) / T), u = (t + hh(sd, 0, 31) * T) - k * T, th = s.throws[Math.floor(hh(sd, k, 32) * s.throws.length) % s.throws.length];
      const o = s.owner, ox = s.x, oz = s.z, bx = th[0], bz = th[1], D = Math.hypot(bx - ox, bz - oz), fly = 1.25, v = 6.2, tOut = 1.1 + D / v, tBack = tOut + 0.9 + D / v;
      this._put(o, ox, oz, th[2], 0, dt);
      const pose = u < 1.0 ? 'throw' : 'stand'; if (o.character.pose !== pose && !o.down) o.character.setPose(pose);
      let dx, dz, dh, sp = 0, dp = 'stand';
      const hx = ox + Math.sin(th[2]) * 1.0, hz = oz + Math.cos(th[2]) * 1.0;
      if (u < 1.1) { dx = hx; dz = hz; dh = th[2]; dp = u < 0.5 ? 'sit' : 'stand'; }
      else if (u < tOut) { const f = (u - 1.1) / (tOut - 1.1); dx = hx + (bx - hx) * f; dz = hz + (bz - hz) * f; dh = th[2]; sp = v; }
      else if (u < tOut + 0.9) { dx = bx; dz = bz; dh = th[2]; dp = 'sniff'; }
      else if (u < tBack) { const f = (u - tOut - 0.9) / (tBack - tOut - 0.9); dx = bx + (hx - bx) * f; dz = bz + (hz - bz) * f; dh = th[2] + Math.PI; sp = v; }
      else { dx = hx; dz = hz; dh = th[2] + Math.PI; dp = u < tBack + 1.5 ? 'stand' : 'sit'; }
      const st = s.dog, y = this._gy(st.x, st.z);
      if (st.a.pose !== dp) st.a.setPose(dp);
      this._putBeast(st, dx, dz, dh, dt, sp, y);
      P._animal(st, 'x', 'z', st.r, 'dog');
      // the ball: in the hand, in the air, on the grass, in the dog's mouth
      const b = s.ball, hy = this._gy(ox, oz);
      if (u < 0.75) b.position.set(ox + Math.sin(th[2]) * 0.3 + Math.cos(th[2]) * -0.25, hy + 1.2, oz + Math.cos(th[2]) * 0.3 - Math.sin(th[2]) * -0.25);
      else if (u < 0.75 + fly) { const f = (u - 0.75) / fly; b.position.set(ox + (bx - ox) * f, hy + 1.3 + 3.2 * 4 * f * (1 - f) - 1.26 * f, oz + (bz - oz) * f); }
      else if (u < tOut + 0.6) b.position.set(bx, this._gy(bx, bz) + 0.04, bz);
      else if (u < tBack + 0.4) b.position.set(st.x + Math.sin(st.h) * st.a.length * 0.5, y + st.a.height * 1.05, st.z + Math.cos(st.h) * st.a.length * 0.5);
      else b.position.set(ox + Math.sin(th[2]) * 0.3, hy + 0.9, oz + Math.cos(th[2]) * 0.3);
      if (s.lk !== k) { s.lk = k; if (hh(sd, k, 33) < 0.35 && P._anyPlayerNear(o, 14)) { o.character.say(OWNER_LINES[Math.floor(hh(sd, k, 34) * OWNER_LINES.length)], 2.5); } if (hh(sd, k, 35) < 0.3) s.barkAt = tBack + 0.3; else s.barkAt = -1; }
      if (s.barkAt > 0 && u >= s.barkAt && u - dt < s.barkAt) bark(g.audio, st.x, y, st.z, st.a.height, 2);
    } else if (s.kind === 'tortoise') {
      // a plod round its lawn (two slow sines: it never leaves the circle), drawn in when anyone comes close
      const st = s.tort, w = 0.012, a = t * w + hh(sd, 0, 41) * TAU, R = s.r * 0.8;
      const x = s.x + Math.sin(a) * R * Math.cos(a * 0.37), z = s.z + Math.cos(a * 1.3) * R * 0.7;
      const x2 = s.x + Math.sin(a + 0.01) * R * Math.cos((a + 0.01) * 0.37), z2 = s.z + Math.cos((a + 0.01) * 1.3) * R * 0.7;
      const N = this._nearest(st.x, st.z, pp), hide = N.d < 1.3;
      if (hide !== (st.a.pose === 'hide')) st.a.setPose(hide ? 'hide' : 'stand');
      if (hide) { st.bx = st.x; st.bz = st.z; st.a.group.position.set(st.x, this._gy(st.x, st.z), st.z); st.a.update(dt, 0); }
      else this._putBeast(st, x, z, Math.atan2(x2 - x, z2 - z), dt, Math.hypot(x2 - x, z2 - z) / 0.01 * w, this._gy(st.x, st.z));
      P._animal(st, 'x', 'z', st.r, 'tortoise');
    } else if (s.kind === 'cat') {
      this._cat(s, t, dt, pp);
    } else {
      const par = s.parent, kid = s.kid, th = hh(sd, 1, 21) * TAU;
      if (s.kind === 'party') {
        // standing and listening; a head turns here and there
        for (const q of s.people) this._put(q, q.homeX, q.homeZ, q.homeH + (q.child ? Math.sin(t * 0.5 + q.sid) * 0.35 : 0), 0, dt);
        const tp = s.parent.character; if (tp.pose !== 'lecture' && !s.parent.down) tp.setPose('lecture');
      } else if (s.kind === 'ducks') {
        // at the water's edge: the child throws a handful every few seconds, the grown-up stands by
        const T = 7, k = Math.floor(t / T + hh(sd, 0, 51)), u = t - (k - hh(sd, 0, 51)) * T;
        this._put(par, par.homeX, par.homeZ, s.h, 0, dt); this._put(kid, kid.homeX, kid.homeZ, s.h, 0, dt);
        const pose = u < 1.1 ? 'throw' : 'stand'; if (kid.character.pose !== pose) kid.character.setPose(pose);
        if (s.lk !== k) { s.lk = k; if (s.feed && this._nearest(s.x, s.z, pp).d < 90) { try { s.feed(kid.x, kid.z, s.h); } catch { /* the place's birds */ } } if (hh(sd, k, 52) < 0.3 && P._anyPlayerNear(kid, 12)) kid.character.say(CHILD_LINES[kid.role][Math.floor(hh(sd, k, 53) * CHILD_LINES[kid.role].length)], 2.5); }
      } else if (s.kind === 'kite') {
        // the kite stands in the wind off to one side, weaving; the child holds the line and backs a step now and then
        const wd = th + 1.2, sway = Math.sin(t * 0.9 + sd) * 0.5, bob = Math.sin(t * 1.7 + sd * 0.3);
        const kx = s.x + Math.sin(t * 0.21 + sd) * 0.7, kz = s.z + Math.cos(t * 0.17 + sd) * 0.7;
        this._put(kid, kx, kz, wd + sway * 0.3, 0.2, dt); this._put(par, par.homeX, par.homeZ, Math.atan2(kid.x - par.x, kid.z - par.z), 0, dt);
        const gy = this._gy(kid.x, kid.z), top = kid.character.dims.top || 1.2, hx = kid.x + Math.sin(kid.heading) * 0.25, hz = kid.z + Math.cos(kid.heading) * 0.25, hy = gy + top * 0.78;
        const R = 10.5, el = 0.85 + bob * 0.07, az = wd + sway * 0.35, K = s.kite;
        K.position.set(hx + Math.sin(az) * Math.cos(el) * R, hy + Math.sin(el) * R, hz + Math.cos(az) * Math.cos(el) * R);
        K.rotation.set(-0.6 + bob * 0.1, az + Math.PI, sway * 0.5, 'YXZ');
        const a = s.line.geometry.attributes.position.array; a[0] = hx; a[1] = hy; a[2] = hz; a[3] = K.position.x; a[4] = K.position.y - 0.1; a[5] = K.position.z; s.line.geometry.attributes.position.needsUpdate = true;
        if (kid.character.pose !== 'lean' && false) kid.character.setPose('stand');
      } else if (s.kind === 'ball') {
        // two children a few steps apart: the ball rolls from one to the other and back, each stepping up to meet it
        const k2 = s.kid2, T = 2.6, n = Math.floor(t / T), u = (t - n * T) / T, fwd = n % 2 === 0;
        const ax = s.x, az = s.z, cx = k2.homeX, cz = k2.homeZ, e = sm(0, 1, Math.min(1, u * 1.35)), f = fwd ? e : 1 - e;
        const b = s.ball, bx = ax + (cx - ax) * (0.08 + 0.84 * f), bz = az + (cz - az) * (0.08 + 0.84 * f);
        b.position.set(bx, this._gy(bx, bz) + 0.11, bz); b.rotation.x = f * 14;
        const step = Math.sin(Math.min(1, Math.max(0, (u - 0.6) / 0.4)) * Math.PI) * 0.5, toB = Math.atan2(cx - ax, cz - az);
        this._put(kid, ax + (fwd ? 0 : Math.sin(toB) * step), az + (fwd ? 0 : Math.cos(toB) * step), toB, fwd ? 0 : step * 1.6, dt);
        this._put(k2, cx - (fwd ? Math.sin(toB) * step : 0), cz - (fwd ? Math.cos(toB) * step : 0), toB + Math.PI, fwd ? step * 1.6 : 0, dt);
        this._put(par, par.homeX, par.homeZ, Math.atan2(bx - par.x, bz - par.z), 0, dt);
      } else if (s.kind === 'scooter') {
        // up the path and back down it (a narrow loop: out along one edge of the path, back along the other, a tight
        // turn at each end), a push of the foot every stroke: core/characters.js 'scoot'
        const Pp = s.path, half = Pp.half, r = 0.55, v = 2.5, Lp = 4 * half + TAU * r, d = ((t * v + hh(sd, 0, 61) * Lp) % Lp + Lp) % Lp;
        let lt, lw, dt2, dw;      // along, across; direction
        if (d < 2 * half) { lt = -half + d; lw = -r; dt2 = 1; dw = 0; }
        else if (d < 2 * half + Math.PI * r) { const a = (d - 2 * half) / r; lt = half + Math.sin(a) * r; lw = -Math.cos(a) * r; dt2 = Math.cos(a); dw = Math.sin(a); }
        else if (d < 4 * half + Math.PI * r) { lt = half - (d - 2 * half - Math.PI * r); lw = r; dt2 = -1; dw = 0; }
        else { const a = (d - 4 * half - Math.PI * r) / r; lt = -half - Math.sin(a) * r; lw = Math.cos(a) * r; dt2 = -Math.cos(a); dw = -Math.sin(a); }
        const x = s.x + Pp.ux * lt + Pp.uz * lw, z = s.z + Pp.uz * lt - Pp.ux * lw, hd = Math.atan2(Pp.ux * dt2 + Pp.uz * dw, Pp.uz * dt2 - Pp.ux * dw);
        this._put(kid, x, z, hd, 0, dt);
        if (kid.character.pose !== 'scoot') kid.character.setPose('scoot');
        const gy = this._gy(kid.x, kid.z), S = s.scoot; S.position.set(kid.x - Math.cos(kid.heading) * 0.06, gy, kid.z + Math.sin(kid.heading) * 0.06); S.rotation.y = kid.heading;
        this._put(par, par.homeX, par.homeZ, Math.atan2(kid.x - par.x, kid.z - par.z), 0, dt);
        if ((s.rt = (s.rt || 0) - dt) <= 0) { s.rt = 0.3; if (this._nearest(kid.x, kid.z, pp).d < 22) scooterRattle(g.audio, kid.x, gy, kid.z, v); }
      } else {
        // a family on the grass: the grown-up sitting, the child pottering about them
        const R = 2.6, a = t * 0.22 + hh(sd, 0, 71) * TAU, x = par.homeX + Math.sin(a) * R * (0.6 + 0.4 * Math.sin(a * 2.3)), z = par.homeZ + Math.cos(a * 1.2) * R * 0.8;
        const x2 = par.homeX + Math.sin(a + 0.02) * R * (0.6 + 0.4 * Math.sin((a + 0.02) * 2.3)), z2 = par.homeZ + Math.cos((a + 0.02) * 1.2) * R * 0.8, sp = Math.hypot(x2 - x, z2 - z) / (0.02 / 0.22);
        this._put(kid, x, z, Math.atan2(x2 - x, z2 - z), sp, dt);
        this._put(par, par.homeX, par.homeZ, Math.atan2(kid.x - par.x, kid.z - par.z), 0, dt);
        if (par.character.pose !== 'sitground' && !par.down) par.character.setPose('sitground');
      }
    }
  }
  /** a cat: sits (or loafs) where it lives and watches whoever comes; when somebody is within a few steps it gets up and
   *  slinks off along its wall — low, tail down, not hurrying unless they follow — and drops out of sight on the far
   *  side (a quad's cat walks off and round the corner); it is back in its place some minutes later */
  _cat(s, t, dt, pp) {
    const st = s.cat, a = st.a, W = s.wall, P = this.peds;
    if (st.hideT > 0) { st.hideT -= dt; if (st.hideT <= 0 && this._nearest(s.x, s.z, pp).d > 25) { st.mode = 0; st.u = 0; st.x = st.bx = s.x; st.z = st.bz = s.z; a.group.visible = true; st.gone = false; } else if (st.hideT <= 0) st.hideT = 5; return; }
    const N = this._nearest(st.x, st.z, pp);
    const toP = Math.atan2(N.x - st.x, N.z - st.z);
    if (st.mode === 0) {
      if (a.pose !== st.pose) a.setPose(st.pose);
      a.look(N.d < 14 ? wrapA(toP - st.h) : Math.sin(t * 0.3 + s.seed) * 0.5, N.d < 6 ? 0.15 : 0);
      if (N.d < (W ? 3.2 : 4.5)) { st.mode = 1; st.dir = W ? (((N.x - st.x) * (W.bx - W.ax) + (N.z - st.z) * (W.bz - W.az)) > 0 ? -1 : 1) : 0; st.away = toP + Math.PI + (hh(s.seed, 1, 81) - 0.5); st.u = 0; a.setPose('crouch'); }
      a.group.position.set(st.x, st.y, st.z); a.group.rotation.y = st.h; a.update(dt, 0);
    } else {
      // slinking off: along the wall away from them (to its end, or eight metres), or across the grass
      const v = N.d < 2.5 ? 2.6 : 1.1; st.u += v * dt;
      let nx, nz, hd, done = false;
      if (W) {
        const ux = (W.bx - W.ax) / W.len, uz = (W.bz - W.az) / W.len, s0 = W.u * W.len, sNow = s0 + st.dir * st.u;
        if (sNow < 0.4 || sNow > W.len - 0.4 || st.u > 8) done = true;
        const q = Math.max(0.3, Math.min(W.len - 0.3, sNow)); nx = W.ax + ux * q; nz = W.az + uz * q; hd = Math.atan2(ux * st.dir, uz * st.dir);
      } else {
        nx = st.x + Math.sin(st.away) * v * dt; nz = st.z + Math.cos(st.away) * v * dt; hd = st.away;
        if (st.u > 9 || P.wet(nx, nz) || !this.game.worldCollider.isFree(nx, nz, 0.15)) { done = true; nx = st.x; nz = st.z; }
      }
      st.x = st.bx = nx; st.z = st.bz = nz; st.h += wrapA(hd - st.h) * Math.min(1, dt * 8);
      a.look(0, 0); a.group.position.set(st.x, W ? st.y : this._gy(st.x, st.z), st.z); a.group.rotation.y = st.h; a.update(dt, v);
      if (done) { st.hideT = 60 + hh(s.seed, Math.floor(t / 60), 82) * 120; a.group.visible = false; st.gone = true; return; }
    }
    if (!W) P._animal(st, 'x', 'z', st.r, 'cat');      // (on a wall it is out of everything's way)
  }
  dispose() { for (const s of this.sites) if (s.on) this._drop(s); this.group.removeFromParent(); }
}
