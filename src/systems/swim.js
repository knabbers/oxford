// Swimming: jump into any river, canal, stream or lake — from a bank, off a bridge, out of a punt — swim, dive, meet the
// fish, climb out again. Nobody drowns: when the air runs out you bob back up.
//
//   Getting in    [E] at a bank ("Dive in") or on a bridge ("Jump off the bridge": up on the parapet, then the leap;
//                 "Jump overboard" from the steamer's deck);
//                 a running jump (Space) that lands in the water; [E] in a punt ("Dive in": the punt stays put and can be
//                 re-boarded from the water with F); or losing the pole in the mud. Banks stay solid to anyone just
//                 walking, so nobody goes in by accident. Entry points come from the collider's water test alone.
//   In the water  WASD swim (breaststroke), Shift front crawl, C / Ctrl dive (swim down), Space swim up.
//                 Under water: murk, light shafts, a river bed with weed and things people threw in, fish, a breath bar.
//   Getting out   [E] "Climb out" at any bank (any dry, free spot within reach); F climbs into a punt alongside.
//   Multiplayer   nothing new on the wire: the player state's pose is 'swim' / 'dive' and its y is the depth; everything
//                 else (splashes, rings, the dive's pitch) is derived by whoever is watching. Fish are a function of the
//                 map cell and the shared clock, so two players see the same schools; scattering is local.
//   Cost          nothing is in the scene and nothing is simulated unless somebody near is in the water (see SwimFx);
//                 a dry player pays one throttled water probe (4 hash lookups, 7 Hz).
//
// game.swim = { active, mode, under, breath, state, enter(), jumpIn(), diveFromPunt(), climbOut(), stats(), fx, bed }
import { SW, BedField, stepSwim, findEntry, findExit } from './_swim_logic.js';
import { SwimFx } from './_swim_fx.js';

const OUT_LINES = [
  'You squelch up the bank. Your shoes may never recover.',
  'Out you get, trailing weed. Somewhere, a duck is judging you.',
  'You haul yourself out. Everything you own is now river.',
  'Dry land. You smell faintly of the Thames and regret nothing.',
];
const IN_LINES = { bridge: 'A fine Oxford tradition, strongly discouraged by the authorities.', punt: 'Man overboard. Deliberately.', steamer: 'Over the rail of the Belle. The skipper does not even look round.' };
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class Swim {
  constructor(game) {
    this.game = game; this.col = game.worldCollider;
    this.mode = null;                       // null | 'jump' | 'swim' | 'climb'
    this.S = { x: 0, z: 0, y: 0, h: 0, speed: 0, vy: 0, breath: 1, forced: false, plunge: false };
    this.I = { mx: 0, my: 0, run: false, dive: false, rise: false, yaw: 0 };
    const isWater = (x, z) => this.col.isWater(x, z);
    this.bed = new BedField(isWater);
    this.E = { isWater, depthAt: (x, z) => this.bed.depthAt(x, z), blocked: (x0, z0, x1, z1) => this._blocked(x0, z0, x1, z1) };
    this.fx = new SwimFx(game);
    this.poseUnder = false; this.wet = 0; this.t = 0; this._tick = 0; this._air = false; this._ty = 1.5; this._pitch = 0;
    this._entry = null; this._entryBuf = {}; this._exit = null; this._exitBuf = {}; this._exitT = 0;
    this._J = null; this._C = null; this._sw = new Float32Array(16); this._strokeU = 0; this._bubT = 0; this._ringT = 0; this._dripT = 0;
    this._hint = false; this.haze = null; this.count = { in: 0, out: 0, forced: 0 };
    this._drive = (dt) => this._move(dt);
    try { import('../world/materials.js').then((m) => { this.haze = m.HAZE || null; }, () => {}); } catch { /* headless */ }
    this._ui();
    this._vh = false;                       // hooked into systems/vehicles.js yet? (it installs after us)
    game.cameraHook = (dt, cam) => this._camera(dt, cam);
  }

  // ---------------------------------------------------------------- prompts / HUD
  _ui() {
    const g = this.game, V3 = g.player.pos.constructor;
    this._ePos = new V3(); this._xPos = new V3();
    this.itemIn = g.interact.add({
      radius: 4.5, pos: () => this._ePos, enabled: () => !!this._entry && !this.mode,
      // (her deck counts as a bridge to the collider - see systems/steamer.js - but it is the side of a boat)
      label: () => (this._entry && this._entry.bridge ? (this._onSteamer() ? 'Jump overboard' : 'Jump off the bridge') : 'Dive in'), onUse: () => this.jumpIn(),
    });
    this.itemOut = g.interact.add({
      radius: 3.4, swim: true, pos: () => this._xPos, enabled: () => this.mode === 'swim' && !!this._exit && this.S.y > -0.7,
      label: () => 'Climb out', onUse: () => this.climbOut(),
    });
    try {
      const host = (g.ui && g.ui.el && g.ui.el.prompt && g.ui.el.prompt.parentNode) || document.body;
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:50%;bottom:31%;transform:translateX(-50%);font-size:18px;background:rgba(0,0,0,.6);padding:8px 16px;border-radius:6px;display:none;white-space:nowrap;pointer-events:none;color:#fff';
      host.appendChild(el); this.elPrompt = el;
      const bar = document.createElement('div');
      bar.style.cssText = 'position:absolute;left:50%;top:13%;transform:translateX(-50%);width:220px;height:12px;border-radius:7px;background:rgba(0,20,10,.55);border:1px solid rgba(220,255,235,.6);display:none;pointer-events:none;overflow:hidden';
      const fill = document.createElement('div'); fill.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#8fe3c8,#d8fff0);border-radius:6px';
      bar.appendChild(fill); host.appendChild(bar); this.elBar = bar; this.elFill = fill;
    } catch { this.elPrompt = this.elBar = this.elFill = null; }
    this._pText = null; this._barW = -1;
  }
  _prompt(text, key = 'E') {
    const t = text ? key + '|' + text : null;
    if (t === this._pText || !this.elPrompt) return;
    this._pText = t;
    if (!text) { this.elPrompt.style.display = 'none'; return; }
    this.elPrompt.innerHTML = `<b style="display:inline-block;background:#f3e7b3;color:#111;border-radius:4px;padding:0 7px;margin-right:8px">${key}</b>${text}`;
    this.elPrompt.style.display = 'block';
  }
  _bar() {
    if (!this.elBar) return;
    const show = this.mode === 'swim' && (this.poseUnder || this.S.breath < 0.995), w = show ? Math.round(this.S.breath * 50) : -1;
    if (w === this._barW) return;
    this._barW = w;
    this.elBar.style.display = show ? 'block' : 'none';
    if (show) { this.elFill.style.width = w * 2 + '%'; this.elFill.style.background = this.S.breath < 0.25 ? '#ff9a7a' : 'linear-gradient(90deg,#8fe3c8,#d8fff0)'; }
  }
  _toast(t, s) { try { this.game.ui.toast(t, s); } catch { /* */ } }
  _onSteamer() { const st = this.game.steamer; return !!(st && st.aboard); }

  // ---------------------------------------------------------------- sound
  _splashSnd(power) {
    const a = this.game.audio; if (!a || !a.ctx) return;
    a.noise(0.5 + 0.2 * power, { gain: Math.min(0.5, 0.26 * power), freq: 650, type: 'lowpass', q: 0.5 });
    a.noise(0.35, { gain: Math.min(0.3, 0.13 * power), freq: 2800, q: 0.8, when: 0.03 });
    a.tone(74, 0.25, { gain: Math.min(0.3, 0.14 * power) });
    a.noise(0.9, { gain: 0.05 * power, freq: 4200, q: 0.6, when: 0.25, attack: 0.2 });     // the water coming back down
  }
  _strokeSnd() { const a = this.game.audio; if (a && a.ctx) a.noise(0.28, { gain: this.poseUnder ? 0.02 : 0.04, freq: this.poseUnder ? 300 : 900 + Math.random() * 300, q: 0.7, attack: 0.06 }); }
  _muffle(on) { const a = this.game.audio; try { if (a && a.muffle) a.muffle(on ? 1 : 0); } catch { /* */ } }

  // ---------------------------------------------------------------- helpers
  _blocked(x0, z0, x1, z1) {
    const t = this.col.raycast(x0, z0, x1, z1);
    if (t !== null && !this.col.isWater(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return true;      // a wall on the bank (parapets over the water are above us)
    const V = this.game.vehicles && this.game.vehicles._sys;
    return !!(V && V.inBuilding && V.inBuilding(x1, z1));
  }
  _dry(x, z) {
    const V = this.game.vehicles && this.game.vehicles._sys;
    return this.col.isFree(x, z, 0.33) && !(V && V.inBuilding && V.inBuilding(x, z));
  }
  _hookVehicles() {
    const V = this.game.vehicles;
    if (!V) return;
    this._vh = true;
    try { if (V.on) V.on('enter', () => { if (this.mode) this._end(true); }); } catch { /* */ }
    try { if (V._sys && V._sys.item) V._sys.item.swim = true; } catch { /* */ }      // "[F] Punt" is also offered to a swimmer
  }
  _ctl() { const g = this.game; return !g.activity && !(g.ui && g.ui.inDialog) && !g.input.typing; }
  _bedAt(x, z, lazy = false) { this.bed.follow(x, z, lazy ? 4 : 3, lazy); }

  // ---------------------------------------------------------------- getting in
  /** Into the water where the player stands (a landed jump, a fall from a punt, a test). opts: {power, vy, quiet} */
  enter(opts = {}) {
    const g = this.game, p = g.player, S = this.S;
    if (p.place !== 'world' || p.vehicle) return false;
    if (!this.col.isWater(p.pos.x, p.pos.z)) return false;
    if (this.mode === 'jump' && this._J && this._J.froze) p.frozen = Math.max(0, p.frozen - 1);
    this._J = null;
    const power = opts.power ?? 0.8;
    S.x = p.pos.x; S.z = p.pos.z; S.h = p.heading; S.y = SW.surfY - 0.2; S.vy = opts.vy ?? -2.2 * Math.sqrt(power); S.speed = Math.min(p.speed || 0, 2) * 0.6;
    S.plunge = true; S.forced = false; S.breath = 1;
    this._bedAt(S.x, S.z);
    this.mode = 'swim'; this.poseUnder = false; this._exit = null; this._entry = null; this.wet = 0;
    p.swim = this._drive; p.pose = 'swim'; p.vy = 0; p.onGround = true; p.pos.y = S.y;
    const ch = p.character; ch.swimPitch = 0; ch.swimStretch = 0; ch.act = -1;
    try { if (g._fp && g._setFirstPerson) g._setFirstPerson(false); } catch { /* */ }
    if (!opts.quiet) { this.fx.splash(S.x, S.z, power); this._splashSnd(power); }
    this.count.in++;
    if (!this._hint) { this._hint = true; this._toast('WASD swim · Shift crawl · C dive · Space surface · E at a bank to climb out', 6); }
    return true;
  }
  /** [E] at a bank or on a bridge: the scripted dive to this._entry (or to `to` = {x, z, bridge}) */
  jumpIn(to = null) {
    const g = this.game, p = g.player, e = to || this._entry || findEntry(this.col, p.pos.x, p.pos.z, p.heading, this._entryBuf);
    if (!e || this.mode || p.vehicle || p.place !== 'world') return false;
    const d = Math.hypot(e.x - p.pos.x, e.z - p.pos.z), bridge = !!e.bridge;
    p.heading = Math.atan2(e.x - p.pos.x, e.z - p.pos.z); p.speed = 0;
    // phase 1 (bridges): up on to the parapet; phase 2: the leap, a ballistic arc that ends on the water
    const T1 = bridge ? 0.85 : 0.14, up = bridge ? 1.0 : 0, fwd = bridge ? Math.min(0.5, d * 0.25) : 0, T2 = (bridge ? 0.78 : 0.56) + d * 0.07, G = 13;
    const y0 = p.pos.y + up, yEnd = SW.surfY + 0.15;
    this._J = { t: 0, T1, T2, x0: p.pos.x, z0: p.pos.z, y0: p.pos.y, up, fwd, x1: e.x, z1: e.z, vy0: (yEnd - (y0 + 1.0) + 0.5 * G * T2 * T2) / T2, G, bridge, power: opts_power(bridge, d), froze: true, from: bridge ? (this._onSteamer() ? 'steamer' : 'bridge') : 'bank' };
    p.frozen++;
    this.mode = 'jump'; p.swim = this._drive; this._entry = null;
    this._bedAt(e.x, e.z, true);            // the bed grid is laid during the jump, a few rows a frame
    const ch = p.character; ch.swimPitch = 0; ch.swimStretch = 1;
    if (bridge) { p.pose = 'climb'; ch.act = 0; } else { p.pose = 'crouch'; }
    if (bridge && this._J.from === 'bridge') { const md = this.game.mayDay; if (md && md.bridgeJump) md.bridgeJump(p.pos.x, p.pos.z); }   // May Morning stewards react
    try { if (g._fp && g._setFirstPerson) g._setFirstPerson(false); } catch { /* */ }
    return true;
  }
  /** [E] in a punt: over the side. The punt stays where it is. */
  diveFromPunt() {
    const g = this.game, p = g.player, v = p.vehicle, V = g.vehicles;
    if (!v || v.kind !== 'punt' || !V || this.mode) return false;
    const lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
    // the side the camera looks towards first
    const side = Math.sin(g.cameraYaw) * lx + Math.cos(g.cameraYaw) * lz >= 0 ? 1 : -1;
    let to = null;
    for (const s of [side, -side]) for (const d of [1.9, 1.5, 2.4]) {
      const x = p.pos.x + lx * d * s, z = p.pos.z + lz * d * s;
      if (!to && this.col.isWater(x, z) && !this._blocked(p.pos.x, p.pos.z, x, z)) to = { x, z, bridge: false };
    }
    if (!to) { this._toast('No room to dive here.', 2); return false; }
    const px = p.pos.x, py = p.pos.y, pz = p.pos.z;
    if (!V.exit(true)) return false;
    p.pos.set(px, py, pz); this._prompt(null);      // (exit() puts you on the bank when one is in reach: we go over the side instead)
    if (!this.jumpIn(to)) return false;
    this._J.from = 'punt'; this._J.power = 1;
    return true;
  }

  // ---------------------------------------------------------------- getting out
  climbOut() {
    const g = this.game, p = g.player, S = this.S;
    if (this.mode !== 'swim') return false;
    const e = this._exit || findExit(this.col, (x, z) => this._dry(x, z), S.x, S.z, S.h, this._exitBuf);
    if (!e) return false;
    this._C = { t: 0, T: 0.95, x0: S.x, z0: S.z, x1: e.x, z1: e.z, y1: g.groundHeight(e.x, e.z) };
    this.mode = 'climb'; p.frozen++;
    p.heading = Math.atan2(e.x - S.x, e.z - S.z); p.pose = 'climb'; p.character.act = 0.42; p.speed = 0;
    this._muffle(false); this.poseUnder = false; this._exit = null;
    this.fx.ring(S.x, S.z, 0.3, 1.2, 1.6, 0.9);
    const a = g.audio; if (a && a.ctx) a.noise(0.6, { gain: 0.1, freq: 1500, q: 0.6, attack: 0.1 });
    return true;
  }
  /** leave the swim state. boarded: stepped straight into a punt (no climb) */
  _end(boarded) {
    const g = this.game, p = g.player, ch = p.character;
    if ((this.mode === 'jump' && this._J && this._J.froze) || this.mode === 'climb') p.frozen = Math.max(0, p.frozen - 1);
    this.mode = null; this._J = null; this._C = null; this._exit = null;
    p.swim = null; ch.act = -1; ch.swimPitch = 0; ch.swimStretch = 0;
    if (!p.vehicle) { p.pose = 'stand'; p.speed = 0; p.vy = 0; p.onGround = true; if (p.place === 'world' && p.pos.y < g.groundHeight(p.pos.x, p.pos.z)) p.pos.y = g.groundHeight(p.pos.x, p.pos.z); }
    this.poseUnder = false; this._muffle(false);
    this.fx.setUnder(false); this.fx.updateFish(0);
    this.wet = 24; this.count.out++;
    this._bar();
    if (boarded) this._toast('You flop into the punt like a landed pike.', 3);
  }

  // ---------------------------------------------------------------- the player's movement while in / entering / leaving the water
  _move(dt) {
    const g = this.game, p = g.player, S = this.S, ch = p.character;
    if (p.place !== 'world' || p.vehicle) { this._end(!!p.vehicle); return; }
    if (this.freeze) return;                // (screenshots: hold this moment)
    if (this.mode === 'jump') {
      const J = this._J; J.t += dt;
      this._bedAt(J.x1, J.z1, true);
      if (J.t < J.T1) {
        const u = J.t / J.T1;
        if (J.bridge) { ch.act = u; p.pos.y = J.y0 + J.up * sm(0.42, 0.9, u); const k = sm(0.3, 1, u); p.pos.x = J.x0 + Math.sin(p.heading) * J.fwd * k; p.pos.z = J.z0 + Math.cos(p.heading) * J.fwd * k; }
      } else {
        const t = J.t - J.T1, u = Math.min(1, t / J.T2);
        if (p.pose !== 'dive') { p.pose = 'dive'; ch.act = -1; J.sx = p.pos.x; J.sz = p.pos.z; }
        // the dive pose turns about the body's centre, a standing one about the feet: ease the origin up as the poses blend
        const lift = sm(0, 0.26, t), vy = J.vy0 - J.G * t, vh = Math.hypot(J.x1 - J.sx, J.z1 - J.sz) / J.T2;
        p.pos.x = J.sx + (J.x1 - J.sx) * u; p.pos.z = J.sz + (J.z1 - J.sz) * u;
        p.pos.y = J.y0 + J.up + lift * 1.0 + J.vy0 * t - 0.5 * J.G * t * t;
        ch.swimStretch = 1; ch.swimPitch = Math.atan2(vy, Math.max(vh, 0.8)) * sm(0, 0.2, t);
        p.speed = vh;
        if (u >= 1 || (t > 0.2 && p.pos.y <= SW.surfY + 0.15)) {
          p.frozen = Math.max(0, p.frozen - 1); J.froze = false;
          p.pos.x = J.x1; p.pos.z = J.z1;
          const from = J.from, power = J.power;
          this.enter({ power, vy: -2.4 * Math.sqrt(power) });
          this._pitch = -0.9; S.speed = Math.min(1.6, vh);
          if (IN_LINES[from] && !this['_said_' + from]) { this['_said_' + from] = true; this._toast(IN_LINES[from], 4); }
        }
      }
      return;
    }
    if (this.mode === 'climb') {
      const C = this._C; C.t += dt;
      const u = Math.min(1, C.t / C.T), k = sm(0.3, 0.95, u);
      ch.act = 0.42 + 0.58 * u;
      p.pos.x = C.x0 + (C.x1 - C.x0) * k; p.pos.z = C.z0 + (C.z1 - C.z0) * k;
      p.pos.y = (SW.surfY - 1.25) + (C.y1 - (SW.surfY - 1.25)) * sm(0.05, 0.8, u);
      if (u >= 1) { p.pos.set(C.x1, C.y1, C.z1); this._end(false); this._toast(OUT_LINES[Math.floor(Math.random() * OUT_LINES.length)], 4); }
      return;
    }
    // ---- swimming
    if (Math.abs(p.pos.x - S.x) + Math.abs(p.pos.z - S.z) > 3) {      // somebody moved the player (a teleport, a cutscene)
      if (!this.col.isWet(p.pos.x, p.pos.z)) { this._end(false); return; }
      S.x = p.pos.x; S.z = p.pos.z; S.h = p.heading;
    }
    const I = this.I, inp = g.input, ctl = !p.frozen && this._ctl();
    I.mx = ctl ? inp.moveX : 0; I.my = ctl ? inp.moveY : 0; I.run = ctl && inp.run; I.yaw = g.cameraYaw;
    I.dive = ctl && (inp.down('KeyC') || inp.down('ControlLeft')); I.rise = ctl && inp.down('Space');
    this._bedAt(S.x, S.z);
    const ev = stepSwim(S, I, dt, this.E);
    p.pos.set(S.x, S.y, S.z); p.heading = S.h; p.speed = S.speed; p.vy = 0; p.onGround = true;
    const under = this.poseUnder ? S.y < SW.headUnder + 0.14 : S.y < SW.headUnder;
    if (under !== this.poseUnder) {
      this.poseUnder = under; this._muffle(under);
      const a = g.audio;
      if (under) { if (a && a.ctx) { a.tone(150, 0.18, { gain: 0.1 }); a.noise(0.3, { gain: 0.08, freq: 400, type: 'lowpass' }); } this.fx.ring(S.x, S.z, 0.2, 1.4, 1.4, 0.8); }
      else { this.fx.ring(S.x, S.z, 0.15, 1.6, 1.6, 1); this.fx.ring(S.x, S.z, 0.1, 0.9, 2.0, 0.7); for (let i = 0; i < 8; i++) this.fx.drop(S.x, SW.surfY + 0.1, S.z, (Math.random() - 0.5) * 1.6, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 1.6, 0.03, 1.2, 0, SW.surfY); if (a && a.ctx) { a.noise(0.22, { gain: 0.07, freq: 900, type: 'lowpass' }); if (S.breath < 0.6) a.noise(0.45, { gain: 0.06, freq: 1900, q: 1.6, when: 0.12, attack: 0.12 }); } }
    }
    if (ev & 4) { this.count.forced++; this._toast('Out of puff! Up you go.', 2.5); }
    p.pose = under ? 'dive' : 'swim';
    const tp = under ? clamp(Math.atan2(S.vy, Math.max(S.speed, 0.7)), -1.1, 1.1) : 0;
    this._pitch += (tp - this._pitch) * Math.min(1, dt * 4);
    ch.swimPitch = this._pitch; ch.swimStretch = Math.max(0, (ch.swimStretch || 0) - dt * 2.5);
    // strokes: a swish and a ring each time the arms come round
    const u = ch._swPh || 0;
    if (S.speed > 0.3 && (u < this._strokeU || (S.speed > 2.2 && u >= 0.5 && this._strokeU < 0.5))) {
      this._strokeSnd();
      if (!under) { const fx = Math.sin(S.h), fz = Math.cos(S.h); this.fx.ring(S.x + fx * 0.5, S.z + fz * 0.5, 0.25, 0.9 + S.speed * 0.25, 1.5, 0.75); this.fx.ring(S.x - fx * 0.7, S.z - fz * 0.7, 0.15, 0.6, 1.2, 0.5); }
    }
    this._strokeU = u;
    if (!under && S.speed <= 0.3 && (this._ringT -= dt) <= 0) { this._ringT = 1.1; this.fx.ring(S.x, S.z, 0.25, 0.55, 2.0, 0.55); }
    if (under && (this._bubT -= dt) <= 0) {
      this._bubT = 0.25 + Math.random() * 0.5 + S.breath * 0.4;
      const fx = Math.sin(S.h), fz = Math.cos(S.h), n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.fx.drop(S.x + fx * 0.75 + (Math.random() - 0.5) * 0.1, S.y + 0.1, S.z + fz * 0.75 + (Math.random() - 0.5) * 0.1, 0, 0.55 + Math.random() * 0.5, 0, 0.012 + Math.random() * 0.022, 4, 1);
      const a = g.audio; if (a && a.ctx && Math.random() < 0.5) a.tone(420 + Math.random() * 500, 0.06, { gain: 0.02 });
    }
  }

  // ---------------------------------------------------------------- camera (replaces the follow camera while in the water)
  _camera(dt, cam) {
    if (!this.mode) return false;
    const g = this.game, p = g.player, inp = g.input, S = this.S;
    if (p.place !== 'world') return false;
    const under = this.mode === 'swim' && this.poseUnder;
    if (inp.locked) {
      g.cameraYaw -= inp.mouseDX * 0.0026;
      g.cameraPitch = clamp(g.cameraPitch + inp.mouseDY * 0.0022, under ? -1.1 : -0.35, 1.35);
      if (inp.wheel) g.cameraDist = clamp(g.cameraDist * (1 + inp.wheel * 0.12), 1.6, 40);
    }
    const pitch = under ? g.cameraPitch : Math.max(-0.35, g.cameraPitch);
    const off = this.mode === 'swim' ? (under ? 0.05 : 0.4) : this.mode === 'jump' ? (p.pose === 'dive' ? 0.3 : 1.3) : 0.9;
    this._ty += (off - this._ty) * Math.min(1, dt * 5);
    const ty = p.pos.y + this._ty, cp = Math.cos(pitch), sp = Math.sin(pitch);
    const dx = -Math.sin(g.cameraYaw) * cp, dz = -Math.cos(g.cameraYaw) * cp;
    let dist = under ? Math.min(g.cameraDist, 5) : g.cameraDist;
    if (!under) { const t = this.col.raycast(p.pos.x, p.pos.z, p.pos.x + dx * dist, p.pos.z + dz * dist); if (t !== null && sp < 0.75) dist = Math.min(dist, Math.max(0.8, t * dist - 0.3)); }
    else for (let i = 0; i < 5 && dist > 0.8 && !this.col.isWater(p.pos.x + dx * dist, p.pos.z + dz * dist); i++) dist *= 0.72;      // stay in the channel
    const cx = p.pos.x + dx * dist, cz = p.pos.z + dz * dist;
    let cy = ty + sp * dist;
    if (under) {
      const top = SW.surfY - 0.2, floor = this.bed.bedY(cx, cz) + 0.22;
      if (cy < floor) cy = floor;
      if (cy > top) cy = top;
    } else {
      const floor = (this.col.isWater(cx, cz) ? SW.surfY : g.groundHeight(cx, cz)) + 0.3;
      if (cy < floor) cy = floor;
    }
    cam.position.set(cx, cy, cz);
    cam.lookAt(p.pos.x, ty, p.pos.z);
    this.fx.setUnder(under, this.bed);
    if (under) this.fx.applyUnder(this.bed, this.haze);
    return true;
  }

  // ---------------------------------------------------------------- per frame (after the player has moved)
  update(dt) {
    const g = this.game, p = g.player, fx = this.fx;
    this.t += dt;
    if (!this._vh) this._hookVehicles();
    const world = p.place === 'world';
    if (this.mode && (!world || p.vehicle)) this._end(!!p.vehicle);
    let nSw = 0; const sw = this._sw;
    if (this.mode === 'swim') {
      const S = this.S;
      sw[0] = S.x; sw[1] = S.z; nSw = 1;
      if ((this._exitT -= dt) <= 0) {
        this._exitT = 0.16;
        this._exit = S.y > -0.7 ? findExit(this.col, (x, z) => this._dry(x, z), S.x, S.z, S.h, this._exitBuf) : null;
        if (this._exit) this._xPos.set(this._exit.x, p.pos.y, this._exit.z);
      }
    } else if (!this.mode && world) {
      // a jump that came down in the water
      if (!p.vehicle) {
        // (the splash is as big as the entry: how fast we were falling and going; a car's knock can fling you in too)
        if (!p.onGround) { this._air = true; this._airV = Math.max(this._airV || 0, -(p.vy || 0)); this._airS = Math.max(this._airS || 0, p.speed || 0); }
        else if (this._air) {
          this._air = false;
          const pw = Math.min(1.7, Math.max(0.5, 0.55 + Math.max(0, (this._airV || 0) - 3) * 0.09 + (this._airS || 0) * 0.05));
          this._airV = 0; this._airS = 0;
          if (this.col.isWet(p.pos.x, p.pos.z)) this.enter({ power: pw });
        }
      }
      if ((this._tick -= dt) <= 0) {
        this._tick = 0.14;
        this._entry = null;
        const v = p.vehicle;
        if (v) {
          if (v.kind === 'punt' && this._ctl() && !p.frozen && !(v.stroke && v.stroke.phase === 'stuck')) this._puntOK = true; else this._puntOK = false;
        } else {
          this._puntOK = false;
          if (!p.frozen && !g.activity && p.onGround) {
            if (this.col.isWet(p.pos.x, p.pos.z)) this.enter({ power: 0.6 });                // put in the water by something else
            else { const e = findEntry(this.col, p.pos.x, p.pos.z, p.heading, this._entryBuf); if (e) { this._entry = e; this._ePos.set(p.pos.x + (e.x - p.pos.x) * 0.5, p.pos.y, p.pos.z + (e.z - p.pos.z) * 0.5); } }
          }
        }
      }
      if (this._puntOK && p.vehicle && p.vehicle.kind === 'punt') {
        this._prompt('Dive in', 'E');
        if (g.input.hit('KeyE') && this._ctl() && !p.frozen) { g.input.pressed.delete('KeyE'); this.diveFromPunt(); }
      } else this._prompt(null);
    } else if (!world) { this._entry = null; this._prompt(null); }
    if (this.mode) this._prompt(null);
    this._bar();

    // other players in the water: their splashes, rings and the pitch of their dives, from the state we already get
    const net = g.net, others = net && net.others;
    if (others && others.size && world) {
      for (const o of others.values()) {
        const inW = o.seen && o.place === 'world' && (o.pose === 'swim' || o.pose === 'dive');
        const near = Math.abs(o.x - p.pos.x) < 90 && Math.abs(o.z - p.pos.z) < 90;
        if (inW !== !!o._swim) {
          o._swim = inW;
          if (near && inW) { fx.splash(o.x, o.z, 1); const pl = g.audio && g.audio.place ? g.audio.place(o.x, o.z, 70) : null; if (pl && pl.gain > 0.02) this._splashSnd(pl.gain); }
          if (!inW) { o.character.swimPitch = 0; o.character.swimStretch = 0; }
          o._swY = o.y; o._swT = 0;
        }
        if (!inW && o.pose === 'dive' && near) {      // still in the air on the way in: stretch out along the arc
          const vy = dt > 0 ? (o.y - (o._swY ?? o.y)) / dt : 0; o._swY = o.y; o._swV = (o._swV || 0) + (vy - (o._swV || 0)) * Math.min(1, dt * 8);
        }
        if (!inW || !near) continue;
        const vy = dt > 0 ? (o.y - o._swY) / dt : 0; o._swY = o.y; o._swV = (o._swV || 0) + (vy - (o._swV || 0)) * Math.min(1, dt * 6);
        const air = o.y > SW.surfY + 0.1;
        o.character.swimPitch = o.pose === 'dive' ? clamp(Math.atan2(o._swV, Math.max(o.speed, 0.7)), -1.2, 1.2) : 0;
        o.character.swimStretch = air ? 1 : Math.max(0, (o.character.swimStretch || 0) - dt * 2.5);
        if (!air && o.pose === 'swim' && (o._swT -= dt) <= 0) { o._swT = o.speed > 0.3 ? 0.8 : 1.3; fx.ring(o.x + Math.sin(o.h) * 0.4, o.z + Math.cos(o.h) * 0.4, 0.25, 0.6 + o.speed * 0.3, 1.5, 0.65); }
        if (nSw < 8) { sw[nSw * 2] = o.x; sw[nSw * 2 + 1] = o.z; nSw++; }
      }
    }

    // fish: under water with the swimmer, dark shapes under the surface for a swimmer or a punter looking down
    const punting = !this.mode && world && p.vehicle && p.vehicle.kind === 'punt';
    if (this.mode === 'swim' || this.mode === 'jump' || punting) {
      if (punting) { this._bedAt(p.pos.x, p.pos.z, true); if (nSw < 8) { sw[nSw * 2] = p.vehicle.x; sw[nSw * 2 + 1] = p.vehicle.z; nSw++; } }
      fx.updateFish(fx.under ? 2 : 1, dt, g.time.now() / 1000, p.pos.x, p.pos.z, this.bed, this.E.isWater, sw, nSw);
    } else if (fx.fishMode) fx.updateFish(0);

    // dripping for a while after getting out
    if (this.wet > 0) {
      this.wet -= dt;
      if (!this.mode && world && !p.vehicle && (this._dripT -= dt) <= 0) {
        this._dripT = 0.08 + 0.5 * (1 - this.wet / 24);
        const a = Math.random() * 6.283, r = 0.12 + Math.random() * 0.16;
        fx.drop(p.pos.x + Math.cos(a) * r, p.pos.y + 0.35 + Math.random() * 1.0, p.pos.z + Math.sin(a) * r, 0, -0.2, 0, 0.014 + Math.random() * 0.012, 1.2, 2, p.pos.y + 0.02);
      }
      if (this.wet <= 0 && world) this._toast('More or less dry again.', 2.5);
    }
    fx.update(dt);
  }

  stats() { return { mode: this.mode, under: this.poseUnder, breath: +this.S.breath.toFixed(3), y: +this.S.y.toFixed(2), wet: +Math.max(0, this.wet).toFixed(1), ...this.count, fx: this.fx.stats() }; }
}
function opts_power(bridge, d) { return bridge ? 2 : 0.9 + Math.min(0.3, d * 0.1); }

export default {
  id: 'swim',
  install(game) {
    const W = new Swim(game);
    game.swim = {
      get active() { return !!W.mode; }, get mode() { return W.mode; }, get under() { return W.poseUnder; }, get breath() { return W.S.breath; },
      get state() { return W.S; }, get entry() { return W._entry; }, get exitSpot() { return W._exit; },
      enter: (o) => W.enter(o), jumpIn: (to) => W.jumpIn(to), diveFromPunt: () => W.diveFromPunt(), climbOut: () => W.climbOut(),
      /** test hook: straight to depth y (negative) */
      debugDive: (y = -1.2) => { if (W.mode === 'swim') { W.S.y = y; W.S.vy = 0; W.S.plunge = false; } },
      stats: () => W.stats(), fx: W.fx, bed: W.bed, _sys: W,
    };
    return { id: 'swim', update: (dt) => W.update(dt) };
  },
};
