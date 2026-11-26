// The Game object: owns renderer, scenes, camera, the frame loop, and references to every subsystem.
import * as THREE from 'three';
import { chaseYaw, chaseFov, chaseBank } from './_chasecam.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Occlusion } from './_occlusion.js';
import { GameTime, migrateSavedClock } from './time.js';
import { Collider } from './collision.js';
import { Interact } from './interact.js';
import { Interiors } from './interiors.js';
import { Player } from './player.js';
import { Net } from './net.js';
import { pageFeatures } from './features.js';
import { installFastMatrix } from './_fastmatrix.js';
import { installLazyLink } from './_lazylink.js';
import { installTexKeep, texKeepStats } from '../world/_tex_keep.js';
import { installGeoFree, geoFreeStats } from '../world/_geo_free.js';

/** Any dt (undefined, NaN, negative, a huge first-frame gap) -> finite seconds in [0, 0.1]. */
export const safeDt = (dt) => (Number.isFinite(dt) && dt > 0 ? (dt < 0.1 ? dt : 0.1) : 0);

export class Game {
  /** the system asks for less motion: no head bob (checked once) */
  static reducedMotion = (() => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  constructor(canvas) {
    this.canvas = canvas;
    installFastMatrix();                         // (static objects no longer recompose their matrices every frame: core/_fastmatrix.js)
    // (`?canvasaa=0`: a MEASURING switch — the canvas without its own multisampling. Not a setting: wherever the scene
    //  is drawn straight onto the canvas — every tier without the post chain, and every walk-in room on every tier —
    //  the canvas's samples are the only anti-aliasing there is.)
    let canvasAA = true; try { if (typeof location !== 'undefined' && /[?&]canvasaa=0(&|$)/.test(location.search)) canvasAA = false; } catch { /* no location */ }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: canvasAA, stencil: true, powerPreference: 'high-performance' });      // (stencil: the openings of walk-in rooms, core/interiors.js)
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    try { installLazyLink(this.renderer); } catch (e) { console.warn('[lazylink]', e); }      // (no frame waits for a program to link: core/_lazylink.js)
    // memory pass: painted textures let go of their canvases once on the card (world/_tex_keep.js, ?texkeep=0), static
    // world geometry of its arrays (world/_geo_free.js, ?geofree=0); game.texKeep.stats() / game.geoFree.stats()
    try { installTexKeep(this.renderer); installGeoFree(this.renderer); } catch (e) { console.warn('[memory]', e); }
    this.texKeep = { stats: texKeepStats }; this.geoFree = { stats: geoFreeStats };
    // A lost WebGL context (the GPU process restarted, the card was reset). What was let go after upload cannot be sent
    // up again in place — the block-compressed atlases' bytes, cache-restored pictures, static geometry arrays — so then
    // the page is loaded again (the texture cache makes that the quick repeat-visit path). With nothing of that kind
    // let go (a lower tier under ?geofree=0) three restores the context in place and the released canvas textures are
    // painted again by their painters as they are drawn (world/_tex_keep.js). `game.contextLoss`: what happened.
    this.contextLoss = { lost: 0, restored: 0, reload: false };
    try {
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault(); this.contextLoss.lost++;
        const reload = this.contextLoss.reload = this._contextNeedsReload();
        console.warn('[game] the WebGL context was lost' + (reload ? ': loading the page again' : ': waiting for it to be restored'));
        if (reload) { try { this.ui && this.ui.toast && this.ui.toast('The graphics were reset. Loading again…', 8); } catch { /* */ } setTimeout(() => { try { location.reload(); } catch { /* */ } }, 900); }
      });
      canvas.addEventListener('webglcontextrestored', () => { this.contextLoss.restored++; console.warn('[game] the WebGL context is back'); });
    } catch { /* no events (the headless tools' canvas) */ }

    this.worldScene = new THREE.Scene();
    // tag every top-level object with the module that added it (for game.perf.report() draw-call attribution)
    this._owner = 'core';
    const sceneAdd = this.worldScene.add;
    this.worldScene.add = (...objs) => {
      for (const o of objs) if (o && o.userData && o.userData.owner === undefined) o.userData.owner = this._owner;
      return sceneAdd.apply(this.worldScene, objs);
    };
    this.scene = this.worldScene;                // the scene currently being rendered (world or an interior)
    this.worldCollider = new Collider();
    this.collider = this.worldCollider;          // collider for the current place
    this._ground = null;                         // interior ground fn, if any
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.15, 2600);
    this.cameraYaw = -Math.PI / 2; this.cameraPitch = 0.28; this.cameraDist = 5.5;
    this.firstPerson = false;                    // the view toggle (G): through the player's own eyes, on foot and in / on vehicles

    this.map = null;                             // parsed map.json
    this.world = null;                           // set by world/index.js: { update(dt), groundHeight(x,z), ... }
    this.overrides = { skip: new Set(), skipCollision: new Set(), heights: new Map(), style: new Map() };
    this.systems = [];                           // {update(dt)}
    this.activity = null;                        // current minigame / scripted activity
    this.vehicles = null;                        // set by systems/vehicles.js
    this.state = Object.assign({ money: 20, flags: {} }, JSON.parse(localStorage.getItem('gto-save') || '{}'));
    migrateSavedClock(this.state);               // day indices in a save made under another hour length (core/time.js)
    this.features = pageFeatures();              // {minimap, bigmap, fastTravel}: off unless ?minimap=1 / ?map=1 / ?fasttravel=1 (core/features.js)

    this.input = new Input(canvas);
    this.time = new GameTime();
    this.audio = new Audio();
    this.audio.occlusion = new Occlusion(this); this.audio.reports.walls = () => this.audio.occlusion.report();
    try { if (new URLSearchParams(globalThis.location ? globalThis.location.search : '').get('walls') === '0') this.audio.occlusion.enabled = false; } catch { /* */ }      // (?walls=0: sound as it was, to compare by ear — a URL switch, no key)      // sound and walls: every positioned sound (core/_occlusion.js)
    this.ui = new UI(this);
    this.interact = new Interact(this);
    this.interiors = new Interiors(this);
    this.player = new Player(this);
    this.net = new Net(this);
    this.worldScene.add(this.player.character.group);
    this.running = false; this.frame = 0; this.elapsed = 0;
    this.cameraHook = null;                      // (dt, camera) => true when it placed the camera this frame (systems/swim.js)
    this.shakeAmt = 0;                           // camera shake (0..1.5), decays; game.shake(amount) adds to it (crashes, knock-downs)
    this.postRender = null;                      // (renderer, scene, camera) => void, replaces the outdoor render when set

    addEventListener('resize', () => this.resize());
    this.resize();
    this.input.onKey((code) => this._key(code));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  save() { localStorage.setItem('gto-save', JSON.stringify(this.state)); }
  /** Add (or with a negative amount, spend) money. Returns false and does nothing if the player can't afford it. */
  pay(amount) {
    if (this.state.money + amount < 0) return false;
    this.state.money = Math.round((this.state.money + amount) * 100) / 100; this.save(); return true;
  }

  /** Register a per-frame system. Its update always receives a finite dt in [0, 0.1], even from test hooks. */
  /** after a lost WebGL context: has anything been let go that cannot be uploaded again in place? */
  _contextNeedsReload() {
    try {
      if (geoFreeStats().freed > 0) return true;
      let gone = false;
      const look = (t) => { if (!t || !t.isTexture || gone) return; if ((t.isCompressedTexture || t.isCompressedArrayTexture) && t.mipmaps && t.mipmaps[0] && !t.mipmaps[0].data) gone = true; const im = t.image; if (im && typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap && !(im.width > 0)) gone = true; };
      this.worldScene.traverse((o) => { const m = o.material; if (!m || gone) return; for (const q of Array.isArray(m) ? m : [m]) for (const k in q) { const v = q[k]; if (v && v.isTexture) look(v); } });
      return gone;
    } catch { return true; }
  }
  addSystem(s) {
    if (s && typeof s.update === 'function' && !s.update._safeDt) {
      const u = s.update;
      s.update = function (dt) { return u.call(this, safeDt(dt)); };
      s.update._safeDt = true;
    }
    this.systems.push(s); return s;
  }

  /** Height of the floor at (x,z) in the current place. */
  groundHeight(x, z) {
    if (this.player && this.player.place !== 'world') return this._ground ? this._ground(x, z) : 0;
    return this.world && this.world.groundHeight ? this.world.groundHeight(x, z) : 0;
  }

  /** Switch the active place (used by Interiors). */
  setPlace(id, scene, collider, groundFn) {
    const grp = this.player.character.group;
    this.scene = scene; this.collider = collider; this._ground = groundFn || null;
    this.player.place = id;
    scene.add(grp);
  }

  /**
   * Start a minigame / scripted activity. While active the player can't move and Esc ends it.
   *  a = { name, hint?, pointer?: 'free' (default) | 'locked', update?(dt), camera?(dt, camera), onKey?(code), onEnd?() }
   *  If a.camera is given it fully controls game.camera each frame; otherwise the normal follow camera runs.
   */
  /** Shake the follow camera: amount ~0.1 (a bump) .. 1 (a big crash); the strongest recent shake wins, decaying in ~0.5 s. */
  shake(amount) { if (amount > this.shakeAmt) this.shakeAmt = Math.min(1.5, amount); }

  beginActivity(a) {
    if (this.activity) this.endActivity();
    this.activity = { pointer: 'free', ...a };
    if (this.activity.pointer === 'free') this.input.unlock();
    this.ui.prompt(null);
    if (a.hint) this.ui.toast(a.hint + '  (Esc to stop)', 5);
  }
  endActivity() {
    const a = this.activity;
    if (!a) return;
    this.activity = null;
    this.ui.closeOverlay();
    try { a.onEnd && a.onEnd(); } catch (e) { console.error(e); }
  }

  _key(code) {
    if (this.ui.inDialog) { if (code === 'KeyE' || code === 'Space' || code === 'Enter') { this.input.pressed.delete(code); this.ui.advanceDialog(); } return; }
    if (this.activity) {
      if (code === 'KeyG' && this.activity.pointer === 'locked' && !this.activity.camera) { this.toggleFirstPerson(); return; }     // (sitting on a bench: the view toggle still works)
      if (code === 'Escape') this.endActivity();
      else if (this.activity.onKey) this.activity.onKey(code);
      return;
    }
    if (code === 'KeyM') { if (this.features.bigmap) this.ui.toggleBigMap(); }   // M is inert unless ?map=1
    else if (code === 'Escape') this.ui.toggleBigMap(false);
    else if (code === 'KeyG') { const v = this.player.vehicle; if (!(v && v.type === null)) this.toggleFirstPerson(); }   // (a glider / a bus seat has its own views: C, G there)
    else if (code === 'KeyT' || code === 'Enter') this._openChat();
  }

  _openChat() {
    const el = this.ui.el.chatinput;
    el.style.display = 'block'; el.value = ''; this.input.typing = true; this.input.keys.clear(); this.input.unlock();
    setTimeout(() => el.focus(), 0);
    el.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' || e.key === 'Escape') {
        const text = el.value.trim();
        if (e.key === 'Enter' && text) { this.ui.chat(this.player.name, text); this.net.send('chat', text); }
        el.style.display = 'none'; el.blur(); this.input.typing = false;
      }
    };
  }

  start() {
    this.running = true; this.input.wantLock = true;
    let last = performance.now();
    // Frame pacing, OFF unless asked for: `?pace=33` (ms; `?pace=1` = 33) — a frame is not started sooner than that
    // after the last one began (less 4 ms: a refresh that comes a little early still counts). Where a frame costs
    // 30-37 ms the browser otherwise starts frames 17 / 33 / 50 ms apart as the GPU frees up; paced, every frame is
    // two refreshes (or three when one is late) — evener, never faster than 30 a second.
    let pace = 0; try { const m = typeof location !== 'undefined' && /[?&]pace=([\d.]+)/.exec(location.search); if (m) pace = +m[1] === 1 ? 33.3 : Math.max(0, Math.min(100, +m[1])); } catch { /* no location */ }
    this.pace = pace;      // (game.pace = ms may be set while running)
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (this.pace > 0 && now - last < this.pace - 4 && now >= last) return;
      if (this.hold) return;      // (game.perf.bench() is drawing its own frames: core/perf.js)
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      this.update(dt);
      const c = this.cull;
      // optional post pass for the outdoor scene (world/post.js sets game.postRender on the 'high' tier only).
      // Walk-in rooms (core/interiors.js): inside one, renderFrame draws the world through its openings and the room
      // over it; outdoors the rooms near by are added after the world (afterWorld; the post path calls it itself).
      const drawWorld = (cam) => {
        if (c) c.before(cam);
        if (this.postRender && this.scene === this.worldScene) this.postRender(this.renderer, this.scene, cam);
        else { this.renderer.render(this.scene, cam); if (this.scene === this.worldScene) this.interiors.afterWorld(this.renderer, cam); }
        if (c) c.after();
      };
      if (!this.interiors.renderFrame(this.renderer, this.camera, drawWorld)) drawWorld(this.camera);
      this.input.endFrame();
    };
    requestAnimationFrame(tick);
  }

  update(dt) {
    // every path into the frame (rAF loop, test hooks calling game.update(), perf probes) gets a finite dt in [0, 0.1]
    dt = safeDt(dt);
    this.frame++; this.elapsed += dt;
    const acc = this._perfAcc, T = acc ? performance : null;
    let t0 = acc ? T.now() : 0;
    const lap = acc ? (id) => { const t = T.now(), ms = t - t0; t0 = t; let r = acc.get(id); if (!r) acc.set(id, (r = { sum: 0, max: 0 })); r.sum += ms; if (ms > r.max) r.max = ms; } : null;
    const a = this.activity;
    this.input.wantLock = !(a && a.pointer === 'free') && !this.ui.bigMapOpen && !this.input.typing;
    if (a && a.update) { try { a.update(dt); } catch (e) { console.error(e); this.endActivity(); } }
    this.player.update(dt);
    if (lap) lap('player+activity');
    for (const s of this.systems) {
      this._owner = s.id || 'system';
      try { s.update && s.update(dt); } catch (e) { if (!s._err) console.error('system error', s.id, e); s._err = true; }
      if (lap) lap(s.id || 'system');
    }
    this._owner = 'core';
    this.interact.update();
    this.interiors.update(dt);
    this.net.update(dt);
    if (lap) lap('interact+interiors+net');
    this._owner = 'world';
    if (this.world && this.world.update) this.world.update(dt);
    this._owner = 'core';
    if (lap) lap('world');
    // (cameraHook: a system may take the camera for a state of its own — swimming — by returning true)
    if (this.activity && this.activity.camera) this.activity.camera(dt, this.camera); else if (!(this.cameraHook && this.cameraHook(dt, this.camera))) this._followCamera(dt);
    this.ui.update(dt);
    if (lap) lap('camera+ui');
  }

  /** First-person view on / off (G). Returns the new state. */
  toggleFirstPerson(on) {
    this.firstPerson = on === undefined ? !this.firstPerson : !!on;
    if (!this.firstPerson) this.cameraPitch = Math.max(-0.35, this.cameraPitch);
    try { this.ui.toast(this.firstPerson ? 'First-person view  (G: back)' : 'Third-person view', 2); } catch { /* headless */ }
    return this.firstPerson;
  }

  /** First person in / on a vehicle: the rider's own eyes (the seat for the pose), looking where the mouse / the chase swing points. */
  _fpVehicle(dt, veh) {
    const p = this.player, ch = p.character, D = ch.dims || {}, cam = this.camera;
    const up = (D.neckY || 1.5) - (D.hipY || 0.945) + (D.headC || 0.12) + 0.03;
    let ey = (D.top || 1.75) - 0.11, fwd = 0.07;
    if (p.pose === 'drive') ey = (D.driveSeat || 0.55) + up - 0.04;
    else if (p.pose === 'cycle') { ey = ((D.cycle && D.cycle.saddle) || 0.95) + up * 0.9; fwd = 0.3; }
    else if (p.pose === 'sit') ey = (D.seat || 0.525) + up - 0.02;
    if (!this._fp || this._fpChar !== ch) this._setFirstPerson(true);
    const cp = Math.cos(this.cameraPitch), sp = Math.sin(this.cameraPitch), sy = Math.sin(this.cameraYaw), cy = Math.cos(this.cameraYaw);
    const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
    const x = p.pos.x + hx * fwd + sy * 0.05, y = p.pos.y + ey, z = p.pos.z + hz * fwd + cy * 0.05;
    cam.position.set(x, y, z);
    cam.lookAt(x + sy * cp * 5, y - sp * 5, z + cy * cp * 5);
    const lean = veh && veh.kind === 'bike' ? -(veh.lean || 0) * 0.7 : 0;
    this._camRoll = (this._camRoll || 0) + (lean - (this._camRoll || 0)) * Math.min(1, dt * 6);
    if (Math.abs(this._camRoll) > 0.001) cam.rotation.z += this._camRoll;
    if (this.shakeAmt > 0.002) { const e = this.elapsed, a = this.shakeAmt * this.shakeAmt * 0.08; cam.position.x += Math.sin(e * 47) * a; cam.position.y += Math.sin(e * 53 + 1) * a; this.shakeAmt *= Math.exp(-dt * 6); } else this.shakeAmt = 0;
  }

  _followCamera(dt) {
    const inp = this.input, p = this.player;
    // (G: first person. Not for a placeholder vehicle that brings its own views — a bus seat, the glider.)
    // Nor during an activity laid out for the view from behind; one that only sits you down somewhere with the mouse
    // still looking about - a bench - keeps it.)
    const act = this.activity;
    const fpUser = !!this.firstPerson && (!act || (act.pointer === 'locked' && !act.camera)) && !(p.vehicle && p.vehicle.type === null);
    if (inp.locked) {
      this.cameraYaw -= inp.mouseDX * 0.0026;
      this.cameraPitch = Math.max(fpUser ? -1.2 : -0.35, Math.min(1.35, this.cameraPitch + inp.mouseDY * 0.0022));
      if (inp.wheel) this.cameraDist = Math.max(1.6, Math.min(40, this.cameraDist * (1 + inp.wheel * 0.12)));
    }
    // chase camera (core/_chasecam.js): in a vehicle the view swings round behind it once the mouse has been still a
    // moment, the lens opens a little with speed, a bike banks the view. The follow camera owns the field of view, so
    // one left odd by a minigame is put right. game.chaseCam = false turns the swing off.
    const veh = p.vehicle && (p.vehicle.type || p.vehicle.chase) && p.vehicle.heading !== undefined ? p.vehicle : null;      // (.chase: a bus passenger looking from outside)
    const cs = this._chase || (this._chase = { idle: 0, rev: 0 });
    this.cameraYaw = chaseYaw(cs, veh, !!(inp.mouseDX || inp.mouseDY), dt, this.cameraYaw, this.chaseCam !== false);
    const fovT = chaseFov(veh);
    if (this.camera.fov !== fovT) { const d = fovT - this.camera.fov; this.camera.fov = Math.abs(d) < 0.03 ? fovT : this.camera.fov + d * Math.min(1, dt * 2.5); this.camera.updateProjectionMatrix(); }
    if (fpUser && p.vehicle) { this._fpVehicle(dt, veh); return; }
    const indoors = p.place !== 'world';
    // Indoors the view sits closer (3.6 m at most). The cap is eased in and out, so walking through a real doorway
    // (core/interiors.js: the place changes in one frame) does not step the camera.
    const capK = (this._capK = (this._capK ?? (indoors ? 1 : 0)) + ((indoors ? 1 : 0) - (this._capK ?? (indoors ? 1 : 0))) * Math.min(1, dt * 2.2));
    const base = this.cameraDist * (!indoors && p.vehicle ? (p.vehicle.camDist || 1.5) : 1);
    let dist = base + (Math.min(base, 3.6) - base) * (capK > 0.995 ? 1 : capK < 0.005 ? 0 : capK);
    // a walk-in doorway near by (or a walk-in room about us): the rays go through open doorways, and are tried against
    // the walls of the other side of the doorway too — the camera follows you through the door instead of stopping at it
    const I = this.interiors, walkIn = !!I && indoors && I.current && I.current.sl && p.place === I.current.id;
    const thru = !!I && !p.vehicle && (walkIn || (!indoors && I.portalNear));
    if (this.collider !== this._camCol) { this._camCol = this.collider; this._colT = 0.45; if (!indoors) this._outT = 2; }      // (a doorway crossed, a storey changed: the walls in force changed under the camera)
    if (this._colT > 0) this._colT -= dt; if (this._outT > 0) this._outT -= dt;
    const ty = p.pos.y + (p.vehicle ? 1.3 : 1.55);
    const cp = Math.cos(this.cameraPitch), sp = Math.sin(this.cameraPitch);
    const dx = -Math.sin(this.cameraYaw) * cp, dz = -Math.cos(this.cameraYaw) * cp;
    // keep walls out of the way. Indoors a fan of five rays (centre, the near plane's edges and ±0.8 m, so a doorway
    // up to ~1.5 m wide behind the player doesn't let the camera slip out of the room); outdoors one ray, as before
    const want = dist;
    const h = Math.hypot(dx, dz) || 1, lx = -dz / h * 0.3, lz = dx / h * 0.3;
    let t = null, tS = null;
    const hitO = this._camHit || (this._camHit = { hit: { s: null }, passages: false }); hitO.passages = thru;
    const fan = indoors ? (thru && I.portalNear ? 1 : 2) : thru ? 1 : 0;      // (by a doorway: the centre and the near plane's edges only)
    for (let k = -fan; k <= fan; k++) {
      // parallel rays offset 0, ±0.3, ±0.8 m (an offset start that is itself behind a wall is skipped)
      const o = k === 2 || k === -2 ? k * 1.35 : k;
      const sx = p.pos.x + lx * o, sz = p.pos.z + lz * o;
      if (k && this.collider.raycast(p.pos.x, p.pos.z, sx, sz) !== null) continue;
      let tk = this.collider.raycast(sx, sz, sx + dx * dist, sz + dz * dist, hitO), sk = hitO.hit.s;
      if (thru) { const to = I.camRay(sx, sz, sx + dx * dist, sz + dz * dist); if (to !== null && (tk === null || to < tk)) { tk = to; sk = null; } }
      if (tk !== null && (t === null || tk < t)) { t = tk; tS = sk; }
    }
    let free = dist, under = false;
    if (t !== null) {
      free = Math.max(0, t * dist - 0.3);
      // outdoors, tall buildings: prefer raising over the wall only if already looking down steeply - and only if the
      // camera then really is above that building (a mapped building's walls know their height, h; a low wall its top; a
      // wall a place drew without saying counts as tall): otherwise it sat inside one, looking down through its floors at
      // the window dressings and string courses ("long beige beams": Keble's Pusey range, opposite the Hooke building)
      under = !!tS && ty + sp * dist < p.pos.y + (tS.h ?? tS.top ?? Infinity) + 0.6;
      if (indoors || sp < 0.75 || under) dist = Math.min(dist, Math.max(indoors ? 0.25 : 0.5, free));
    }
    // indoors: pull in at once when blocked, ease back out (no popping in and out against door frames)
    // (when the walls themselves have just changed — a doorway crossed, a storey changed on a stair — the pull-in is a
    //  quick glide, not a cut: nothing real moved in front of the camera; for a moment after leaving a room it eases
    //  back out as it does indoors)
    if (indoors || this._outT > 0 || this._colT > 0) {
      const cur = this._camD ?? dist;
      this._camD = dist < cur ? (this._colT > 0 ? Math.max(dist, cur - 9 * dt) : dist) : cur + (dist - cur) * Math.min(1, dt * 3);
      dist = Math.min(this._camD, want);
    } else this._camD = dist;
    // Low ceilings, beams, the soffit of the floor above a stair (a room whose ceilings are prepared: _ceilingPrep).
    // Rather than be pressed flat under them — below its place, looking up at the ceiling — the camera comes in to the
    // longest distance at which it sits clear with a clear line to the head under whatever lies between (a glide in,
    // eased back out); when that is very close the tight-room first person takes over (below).
    const CG = indoors && !p.vehicle && !fpUser ? this.scene.userData._ceilGrid : null;
    let fitD = dist, fpC = false;
    if (CG) {
      fitD = this._ceilFit(CG, p, dx, dz, sp, ty, dist);
      const tight = fitD < dist - 0.01, to = tight ? fitD : want;
      let cur = this._ceilD ?? dist; if (tight && cur > dist) cur = dist;
      this._ceilD = to < cur ? Math.max(to, cur - 10 * dt) : cur + (to - cur) * Math.min(1, dt * 3);
      if (this._ceilD < dist) dist = this._ceilD;
      fpC = tight && fitD < (this._fp ? 1.25 : 1.0);
    } else this._ceilD = undefined;
    // too tight for a third-person view (narrow staircases, the Lodge, corridors): first person with the head hidden
    // (outdoors too, when a wall right behind the player would otherwise fill the screen with the back of their shirt)
    const fp = !p.vehicle && (fpUser || fpC || (indoors ? (this._fp ? free < 1.7 : free < 1.4)
      : t !== null && (sp < 0.75 || under) && (this._fp ? free < 1.1 : free < 0.8)));
    if (fp !== !!this._fp || (fp && this._fpChar !== p.character)) this._setFirstPerson(fp);
    if (fp) {
      // through the player's eyes: a little ahead of the neck the way the view points (so looking down shows your own
      // chest, arms and feet, not the inside of your collar), dipping as the head tips forward
      const D = p.character.dims, seated = D && (p.pose === 'sit' || p.pose === 'write');
      const top = !D ? 1.6 : seated ? (D.seat || 0.525) + (D.neckY - D.hipY) + D.headC + 0.01 : (D.top || 1.7) - 0.1;      // (sitting on a bench: the eyes are over the hips)
      // a slight head bob with the stride when the view was asked for (not the automatic tight-room one; not with
      // prefers-reduced-motion): one dip per step, a hint of sway per stride
      let bob = 0, sway = 0;
      if (fpUser && !Game.reducedMotion) {
        const want = p.onGround !== false && !p.down ? Math.min(1, (p.speed || 0) / 2.6) * (1 + 0.5 * Math.max(0, Math.min(1, ((p.speed || 0) - 2.6) / 3.6))) : 0;
        this._bobA = (this._bobA || 0) + (want - (this._bobA || 0)) * Math.min(1, dt * 7);
        this._bobP = ((this._bobP || 0) + (p.speed || 0) * dt * 4.5) % (Math.PI * 4);
        bob = Math.sin(this._bobP * 2) * 0.014 * this._bobA; sway = Math.sin(this._bobP) * 0.007 * this._bobA;
      }
      // (the head tips about the top of the neck: looking down, the eyes come forward over the chest)
      const sy = Math.sin(this.cameraYaw), cy = Math.cos(this.cameraYaw), fw = Math.max(0.02, 0.09 * cp + 0.13 * sp);
      const ex = p.pos.x + sy * fw + cy * sway, ez = p.pos.z + cy * fw - sy * sway, eye = p.pos.y + top + bob - 0.13 + 0.13 * cp - 0.09 * sp;
      this.camera.position.set(ex, eye, ez);
      this.camera.lookAt(ex + sy * cp * 5, eye - sp * 5, ez + cy * cp * 5);
      if (p.drunk > 0) this.camera.rotation.z += Math.sin(this.elapsed * 0.9) * 0.06 * p.drunk;
      this._ceilL = undefined;      // (the eased ceiling limit starts afresh when the view goes back out)
      if (this._camBlend) this._camBlend(dt);
      return;
    }
    const cx = p.pos.x + dx * dist, cz = p.pos.z + dz * dist;
    let cy = ty + sp * dist;
    const floor = this.groundHeight(cx, cz) + 0.25;
    // indoors the camera stays under the ceiling (low vaults, stairs climbing past the ceiling of the room behind you)
    // (a prepared room: under the lowest thing over the whole line from the head to the camera, 0.3 m either side of it —
    //  a beam between the old grid's points was missed, and the view must not bob up into the gaps between joists; 0.22 m
    //  under it, or head height under a ceiling lower than that. The limit itself is eased: it never steps.)
    if (CG) {
      const M = this._ceilM, st = this._ceilStep, c = M[Math.min(this._ceilN, Math.ceil(dist / st + 0.2))];
      if (c < 1e8) {
        let l = this._ceilL; if (l === undefined || this._ceilLS !== this.scene) l = c; else l = c < l ? Math.max(c, l - 8 * dt) : l + (c - l) * Math.min(1, dt * 2);
        this._ceilL = l; this._ceilLS = this.scene;
        const lim = Math.max(l - 0.22, Math.min(l - 0.14, p.pos.y + 1.62)); if (cy > lim) cy = lim;
      } else this._ceilL = undefined;
    } else if (indoors) { const c = this._ceilingAt(cx, cz, Math.min(p.pos.y, floor - 0.25) + 1.2); if (c !== null && cy > c - 0.14) cy = c - 0.14; }
    if (thru) { const lim = I.camCeil(cx, cy, cz); if (lim !== null && cy > lim) cy = lim; }      // (under the lintel through a doorway)
    // (a real room that stands in the WORLD scene, so the camera is "outdoors" in it - Exeter's Hall and Chapel: the place
    //  sets game.roofOver(x, z, player) -> the highest the camera may be there, or null; the view stays under its roof)
    if (!indoors && this.roofOver) { const lim = this.roofOver(cx, cz, p); if (lim != null && cy > lim) cy = lim; }
    // (indoors a floor far above the player's feet is another storey's — the attic over the foot of a stair, a gallery:
    //  the camera is not lifted onto it)
    if (cy < floor && !(indoors && floor - 0.25 > p.pos.y + 1.9)) cy = floor;
    this.camera.position.set(cx, cy, cz);
    if (p.drunk > 0) this.camera.position.x += Math.sin(this.elapsed * 1.3) * 0.25 * p.drunk;
    let sx = 0, sy = 0;
    if (this.shakeAmt > 0.002) {
      // crash shake: a few incommensurate sines (no allocation, no randomness), on the camera and its target
      const e = this.elapsed, a = this.shakeAmt * this.shakeAmt * 0.22;
      sx = (Math.sin(e * 47) + Math.sin(e * 71) * 0.6) * a; sy = (Math.sin(e * 53 + 1) + Math.sin(e * 83) * 0.5) * a;
      this.camera.position.x += sx; this.camera.position.y += sy;
      this.shakeAmt *= Math.exp(-dt * 6);
    } else this.shakeAmt = 0;
    this.camera.lookAt(p.pos.x + sx * 0.5, ty + sy * 0.5, p.pos.z);
    if (p.drunk > 0) this.camera.rotation.z += Math.sin(this.elapsed * 0.9) * 0.06 * p.drunk;
    // on a bike the view banks a little with the bike into a corner
    this._camRoll = (this._camRoll || 0) + (chaseBank(veh) - (this._camRoll || 0)) * Math.min(1, dt * 5);
    if (Math.abs(this._camRoll) > 0.001) this.camera.rotation.z += this._camRoll;
    if (this._camBlend) this._camBlend(dt);
  }
  /** between third person and first person: the camera travels from where it was (a clear line to the head) in 0.22 s */
  _camBlend(dt) {
    if (!(this._blendT > 0) || !this._bp) return;
    this._blendT -= dt; if (this._blendT <= 0) return;
    const k = 1 - this._blendT / 0.22, s = k * k * (3 - 2 * k), cam = this.camera, q = this._tq || (this._tq = new THREE.Quaternion());
    q.copy(cam.quaternion); cam.position.lerpVectors(this._bp, cam.position, s); cam.quaternion.copy(this._bq).slerp(q, s);
  }

  /**
   * Height of the first solid surface above (x, y0, z) in the current interior, or null. Sampled by ray-casting the
   * interior's static meshes on a 0.5 m grid, cached per scene (a few rays the first time the camera visits a grid
   * square, a Map lookup afterwards) and interpolated so the clamp does not step as the camera moves.
   */
  _ceilingAt(x, z, y0) {
    const scene = this.scene, ud = scene.userData;
    if (ud._ceilGrid) return this._ceilingGrid(ud._ceilGrid, x, z, y0);
    let C = ud._ceil;
    if (!C) C = ud._ceil = { n: -1, list: [], cells: new Map() };
    if (C.n !== scene.children.length) {
      C.n = scene.children.length; C.list.length = 0;
      scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.geometry && !(o.material && o.material.isMeshBasicMaterial && o.material.transparent)) C.list.push(o); });
    }
    if (!this._ceilRay) { this._ceilRay = new THREE.Raycaster(); this._ceilRay.far = 14; this._ceilRay.ray.direction.set(0, 1, 0); this._ceilHits = []; }
    const G = 0.5, iy = Math.round(y0), gx = x / G, gz = z / G, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const sample = (i, j) => {
      const key = (i + 2048) + (j + 2048) * 4096 + (iy + 64) * 16777216;
      let v = C.cells.get(key);
      if (v === undefined) {
        const R = this._ceilRay, hits = this._ceilHits; hits.length = 0;
        R.ray.origin.set(i * G, y0, j * G);
        v = null;
        try { R.intersectObjects(C.list, false, hits); } catch { /* a mesh that cannot be ray-cast: no ceiling known */ }
        for (const h of hits) if (h.distance > 0.05 && h.object.visible) { v = h.point.y; break; }
        C.cells.set(key, v);
      }
      return v;
    };
    const a = sample(ix, iz), b = sample(ix + 1, iz), c = sample(ix, iz + 1), d = sample(ix + 1, iz + 1);
    if (a === null || b === null || c === null || d === null) {
      let m = null; for (const v of [a, b, c, d]) if (v !== null && (m === null || v < m)) m = v;
      return m;
    }
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  }

  /**
   * A room's ceilings made ready ahead of the camera (core/interiors.js calls it when a walk-in room is built): every
   * static triangle that is not vertical, bucketed by the 1 m square it lies over, so "what is above this point" is a
   * handful of triangle tests — the first camera pass through a room no longer ray-casts whole merged meshes.
   */
  _ceilingPrep(scene) {
    const cells = new Map(), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    scene.updateMatrixWorld(true);
    const skip = (o) => { for (let q = o; q; q = q.parent) if (q.name === 'door' || q.name === 'character' || q.visible === false) return true; return false; };
    scene.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position || (o.material && o.material.transparent) || skip(o)) return;
      const g = o.geometry, P = g.attributes.position, idx = g.index ? g.index.array : null, n = idx ? idx.length : P.count; if (P.isInterleavedBufferAttribute) return;
      // (the winding is kept true — a mirrored mesh, a back-sided material turn it — and a double-sided triangle goes in
      //  both ways round: the camera's ceiling test tells a soffit, which faces down, from the top of a settle's back)
      const mat = Array.isArray(o.material) ? o.material[0] : o.material, side = mat ? mat.side : THREE.FrontSide, flip = (o.matrixWorld.determinant() < 0) !== (side === THREE.BackSide), both = side === THREE.DoubleSide;
      for (let t = 0; t + 2 < n; t += 3) {
        for (let k = 0; k < 3; k++) v[flip ? 2 - k : k].fromBufferAttribute(P, idx ? idx[t + k] : t + k).applyMatrix4(o.matrixWorld);
        const ax = v[1].x - v[0].x, az = v[1].z - v[0].z, bx = v[2].x - v[0].x, bz = v[2].z - v[0].z, area = Math.abs(ax * bz - az * bx);
        if (area < 0.002) continue;                                    // vertical (a wall): nothing to be under
        const x0 = Math.floor(Math.min(v[0].x, v[1].x, v[2].x)), x1 = Math.floor(Math.max(v[0].x, v[1].x, v[2].x)), z0 = Math.floor(Math.min(v[0].z, v[1].z, v[2].z)), z1 = Math.floor(Math.max(v[0].z, v[1].z, v[2].z));
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4096) continue;
        for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const key = (i + 2048) + (j + 2048) * 4096; let a = cells.get(key); if (!a) cells.set(key, (a = [])); a.push(v[0].x, v[0].y, v[0].z, v[1].x, v[1].y, v[1].z, v[2].x, v[2].y, v[2].z); if (both) a.push(v[0].x, v[0].y, v[0].z, v[2].x, v[2].y, v[2].z, v[1].x, v[1].y, v[1].z); }
      }
    });
    for (const [k, a] of cells) cells.set(k, new Float32Array(a));
    scene.userData._ceilGrid = { cells, cache: new Map() };
  }
  _ceilingGrid(G, x, z, y0) {
    const S = 0.5, iy = Math.round(y0), gx = x / S, gz = z / S, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const sample = (i, j) => {
      const key = (i + 2048) + (j + 2048) * 4096 + (iy + 64) * 16777216;
      let h = G.cache.get(key); if (h !== undefined) return h;
      const px = i * S, pz = j * S, a = G.cells.get((Math.floor(px) + 2048) + (Math.floor(pz) + 2048) * 4096); h = null;
      if (a) for (let t = 0; t < a.length; t += 9) {
        const x0 = a[t], z0 = a[t + 2], e1x = a[t + 3] - x0, e1z = a[t + 5] - z0, e2x = a[t + 6] - x0, e2z = a[t + 8] - z0, den = e1x * e2z - e1z * e2x;
        if (Math.abs(den) < 1e-9) continue;
        const dx = px - x0, dz = pz - z0, u = (dx * e2z - dz * e2x) / den, w = (e1x * dz - e1z * dx) / den;
        if (u < 0 || w < 0 || u + w > 1) continue;
        const y = a[t + 1] + u * (a[t + 4] - a[t + 1]) + w * (a[t + 7] - a[t + 1]);
        if (y > y0 + 0.05 && (h === null || y < h)) h = y;
      }
      G.cache.set(key, h); return h;
    };
    const a = sample(ix, iz), b = sample(ix + 1, iz), c = sample(ix, iz + 1), d = sample(ix + 1, iz + 1);
    if (a === null || b === null || c === null || d === null) { let m = null; if (a !== null) m = a; if (b !== null && (m === null || b < m)) m = b; if (c !== null && (m === null || c < m)) m = c; if (d !== null && (m === null || d < m)) m = d; return m; }
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  }

  // ---- ceilings over the camera in a prepared room: 0.25 m squares, each the lowest thing over it (cached)
  /** what is overhead at a point, from the room's triangle buckets (no cache): the lowest surface that faces DOWN above
   *  yb (about head height over the floor there) — a ceiling, a beam's soffit, a lintel, the underside of the floor
   *  above; not the top of a settle's back or of that floor, nor a counter's pumps — or null */
  _ceilPoint(G, px, pz, yb) {
    const a = G.cells.get((Math.floor(px) + 2048) + (Math.floor(pz) + 2048) * 4096); let h = null;
    if (a) for (let t = 0; t < a.length; t += 9) {
      const x0 = a[t], z0 = a[t + 2], e1x = a[t + 3] - x0, e1z = a[t + 5] - z0, e2x = a[t + 6] - x0, e2z = a[t + 8] - z0, den = e1x * e2z - e1z * e2x;
      if (Math.abs(den) < 1e-9) continue;
      const dx = px - x0, dz = pz - z0, u = (dx * e2z - dz * e2x) / den, w = (e1x * dz - e1z * dx) / den;
      if (u < 0 || w < 0 || u + w > 1) continue;
      const y = a[t + 1] + u * (a[t + 4] - a[t + 1]) + w * (a[t + 7] - a[t + 1]);
      if (den > 0 && y > yb && (h === null || y < h)) h = y;
    }
    return h;
  }
  /** the lowest thing over the 0.25 m square (i, j) above height band b (quarter metres), or null: nine points, cached */
  _ceilCell(G, i, j, b) {
    const M = G.cmin || (G.cmin = new Map()), key = (i + 8192) + (j + 8192) * 16384 + (b + 512) * 268435456;
    let h = M.get(key); if (h !== undefined) return h;
    h = null; const yb = b * 0.25;
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) { const v = this._ceilPoint(G, (i + a * 0.5) * 0.25 + (a === 0 ? 0.004 : a === 2 ? -0.004 : 0), (j + c * 0.5) * 0.25 + (c === 0 ? 0.004 : c === 2 ? -0.004 : 0), yb); if (v !== null && (h === null || v < h)) h = v; }
    M.set(key, h); return h;
  }
  /** the same with small things taken out (cached): a square is as low as the lowest run of three squares in a line
   *  through it — a beam, a lintel, the edge of a floor stay; a pendant lamp or a hanging sign (the camera does not go
   *  into first person to pass one) is read as the ceiling round it. Infinity: nothing over it. */
  _ceilCellBig(G, i, j, b) {
    const M = G.cbig || (G.cbig = new Map()), key = (i + 8192) + (j + 8192) * 16384 + (b + 512) * 268435456;
    let h = M.get(key); if (h !== undefined) return h;
    h = Infinity;
    for (let q = 0; q < 4; q++) {
      const di = q === 1 ? 0 : 1, dj = q === 0 ? 0 : q === 3 ? -1 : 1;
      for (let s0 = -2; s0 <= 0; s0++) {
        let m = -Infinity;
        for (let t = s0; t < s0 + 3; t++) { const c = this._ceilCell(G, i + t * di, j + t * dj, b), v = c === null ? Infinity : c; if (v > m) m = v; }
        if (m < h) h = m;
      }
    }
    M.set(key, h); return h;
  }
  /** the lowest thing over the squares within r of the point (above height y0), or Infinity */
  _ceilMin(G, x, z, r, y0) {
    const b = Math.floor(y0 * 4), i0 = Math.floor((x - r) * 4), i1 = Math.floor((x + r) * 4), j0 = Math.floor((z - r) * 4), j1 = Math.floor((z + r) * 4), r2 = r * r;
    let L = Infinity;
    for (let i = i0; i <= i1; i++) {
      const ex = Math.max(i * 0.25 - x, 0, x - (i + 1) * 0.25);
      for (let j = j0; j <= j1; j++) {
        const ez = Math.max(j * 0.25 - z, 0, z - (j + 1) * 0.25); if (ex * ex + ez * ez > r2) continue;
        const c = this._ceilCellBig(G, i, j, b); if (c < L) L = c;
      }
    }
    return L;
  }
  /**
   * The longest camera distance <= dmax (along (dx, dz) from the player, rising sp a metre from height ty) at which the
   * camera is not pressed down out of its place. With M the lowest thing over the line from the head to the camera and
   * 0.3 m about it, the camera may sit 0.22 m under M (or at head height under a ceiling lower than that), and that
   * must not cost it more than a third of its height above the head. Leaves M along the line in this._ceilM (one value
   * a step this._ceilStep, this._ceilN steps) for the height clamp.
   */
  _ceilFit(G, p, dx, dz, sp, ty, dmax) {
    const A = this._ceilM || (this._ceilM = new Float32Array(66));
    const n = Math.max(1, Math.min(64, Math.ceil(dmax / 0.25))), st = Math.max(dmax, 0.05) / n; this._ceilN = n; this._ceilStep = st;
    const px = p.pos.x, pz = p.pos.z, head = p.pos.y + 1.62;
    let M = Infinity, good = 0, out = -1; A[0] = 1e9;
    for (let k = 1; k <= n; k++) {
      const d = k * st, x = px + dx * d, z = pz + dz * d, m = Math.min(M, this._ceilMin(G, x, z, 0.3, this.groundHeight(x, z) + 1.8)), cw = ty + sp * d;
      A[k] = m === Infinity ? 1e9 : m;
      if (out < 0 && m !== Infinity && Math.max(m - 0.22, Math.min(m - 0.14, head)) < cw - 0.35 * Math.max(0, cw - ty) - 0.05) {
        // between the last distance that fitted and this one: halve five times
        let lo = good, hi = d;
        for (let q = 0; q < 5; q++) {
          const mid = (lo + hi) / 2, c2 = ty + sp * mid, x2 = px + dx * mid, z2 = pz + dz * mid, m2 = Math.min(M, this._ceilMin(G, x2, z2, 0.3, this.groundHeight(x2, z2) + 1.8));
          if (m2 !== Infinity && Math.max(m2 - 0.22, Math.min(m2 - 0.14, head)) < c2 - 0.35 * Math.max(0, c2 - ty) - 0.05) hi = mid; else lo = mid;
        }
        out = lo;
      }
      M = m; if (out < 0) good = d;
    }
    A[n + 1] = A[n];
    return out < 0 ? dmax : out;
  }

  /** First-person fallback for tight rooms: hide the local player's head (and hat/hair) from the camera, or restore. */
  _setFirstPerson(on) {
    // (the change of view is eased over a fifth of a second from where the camera was — _camBlend — not cut)
    if (!!this._fp !== !!on && this.camera && this.frame > 2) { (this._bp || (this._bp = new THREE.Vector3())).copy(this.camera.position); (this._bq || (this._bq = new THREE.Quaternion())).copy(this.camera.quaternion); this._blendT = 0.22; }
    this._fp = on;
    const prev = this._fpChar;
    if (prev && prev.head && prev !== this.player.character) prev.head.visible = true;
    const ch = this.player.character, head = ch && ch.head;
    if (head) head.visible = !on;          // characters.js collapses a hidden head in the skinned mesh as well
    this._fpChar = on ? ch : null;
    // the near plane comes in while the eye is inside the body's own space (shoulders, a wall at arm's length, a bus window)
    const near = on ? 0.1 : 0.15, cam = this.camera;
    if (cam && (cam.near === 0.1 || cam.near === 0.15) && cam.near !== near) { cam.near = near; cam.updateProjectionMatrix(); }
  }
}
