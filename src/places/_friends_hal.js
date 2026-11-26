// Miguel in hal (owned by places/friends.js). The user: Miguel says Hall as "hal", often invites people to come with him,
// and inside asks the cook "Do you have any schicken deepers?". His hal trips are on the shared clock (_friends_logic.js
// halTrips: a meal with no chicken-dippers session of that kind); while he is in Hall the outdoor figure is hidden
// (friends.js SPOTS.halIn) and this module draws a second figure in the Hall interior (worcester_interiors.js, built by
// _worcint_hall.js), like Prof. Yang at high table (_friends_yang.js). It also draws the Hall cook: a generic, unnamed
// cook in whites standing in the servery doorway behind the hot counter (the steel hot-plate counter with its tray
// stack across the servery's folding door, in the south-west corner behind the column screen), at every meal.
//
// The indoor scene is a function of t = seconds since the trip's inT + HAL_DOOR_S: in at the west door, across the
// screens passage to the counter, "Do you have any schicken deepers?", the cook's answer (by game day and meal: the same
// for everyone), on lucky days his "Mmmm, shicken deepers." and a clap; then a bench seat until he goes back out. Lines
// fire once per arrival, when t passes their moment, for every player in Hall (players who come in later see the rest).
// [E] Talk to the cook: at lunch / dinner a plate of the day for a few pounds (game.pay, the eatEffects pattern of
// pizza_artisan.js / the kebab van).
import * as THREE from 'three';
import { createCharacter, randomLook } from '../core/characters.js';
import { lookFor } from './_people.js';
import { trackAt, halLinesBetween, halEnd, HAL_T, COOK_TALK, COOK_PRICE } from './_friends_logic.js';
import { meal as hallMeal, menuItem } from './_worcint_logic.js';
import { eatEffects } from './_pizza_logic.js';
import { HALL_MARKS as HM } from './_worcint_hall_plan.js';

const ROOM = 'worcint_hall';
// marks in the Hall frame, from the Hall's own plan (_worcint_hall_plan.js HALL_MARKS; the room is 17.9 x 9.0 m: x 0 =
// west wall with the door 0.6 m north of the centre line; the screen's two columns at x 2.33, z ±2.3; the servery's
// folding door in the south wall at x 0.7–1.9 with the hot counter across it; three rows of tables from x 3.9, the
// aisles between them at z ±1.2)
const DOOR_IN = HM.doorIn, COUNTER = [HM.servery[0] - 0.35, HM.servery[1]], PASSAGE = [1.3, 1.5], WEST_AISLE = [3.2, HM.aisle], SCREEN = [2.7, DOOR_IN[1]];
/** where his indoor scene picks him up / lets him go (friends.js walks him between it and the real door when Hall is a walk-in room) */
export const HAL_DOOR_IN = DOOR_IN;
export const COOK_AT = HM.cook;
const COOK_FACE = Math.PI;                    // facing north, across the counter
// the diners worcester_interiors.js seats at a meal: seats[(k + day * 7) % n] for these k (so he never sits on one)
const NPC_PICKS = Array.from({ length: 12 }, (_, i) => 3 + i * 13);
// the middle table's south bench (14 places a bench: 0–13 north row's north side … 42–55 this one), near its west end
const SEAT_PREF = [44, 45, 43, 46, 42];
const WALK = 1.25;                            // m/s: his pace from the door to the counter
const COOK_LOOK = (() => { const L = randomLook(98121, { outfit: 'chef' }); return { ...L, figure: 'f', hairStyle: 'bun', beard: null, height: 1.63, build: 1.04 }; })();
const hCook = Math.atan2(COOK_AT[0] - COUNTER[0], COOK_AT[1] - COUNTER[1]);
const len = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };

/** Miguel's indoor track for a trip (seat from the Hall's seats and the game day) */
export function halTrack(trip, seat) {
  const end = halEnd(trip), sx = seat.x, sz = seat.z, A = [sx, WEST_AISLE[1]];
  // (the counter is a few steps from the door now: he walks there at his own pace and waits his turn until HAL_T.counter)
  const way = [DOOR_IN, [0.95, 0.9], COUNTER], tArr = Math.min(HAL_T.counter - 0.4, len(way) / WALK);
  const tr = [
    [0, tArr, way, null, 'stand'],
    [tArr, HAL_T.counter, [COUNTER], hCook, 'stand'],
    [HAL_T.counter, HAL_T.leaveCounter, [COUNTER], hCook, 'talk'],
    [HAL_T.leaveCounter, HAL_T.seated, [COUNTER, PASSAGE, WEST_AISLE, A, [sx, sz]], null, 'stand'],
    [HAL_T.seated, end - 6.6, [[sx, sz]], seat.h, 'sit'],
    [end - 6.6, end - 0.3, [[sx, sz], A, WEST_AISLE, SCREEN, DOOR_IN], null, 'stand'],
  ];
  for (const s of tr) s.push(len(s[2]));
  return tr;
}
export function halSeat(R, day) {
  const n = R.seats.length, taken = new Set(NPC_PICKS.map((k) => (((k + day * 7) % n) + n) % n));
  for (const i of SEAT_PREF) if (R.seats[i] && !taken.has(i)) return R.seats[i];
  return R.seats[SEAT_PREF[0]] || R.seats[0];
}

export class HalScene {
  /** opts: { voices (FriendVoices), label, talk() (Miguel's [E] Talk dialog), day() } */
  constructor(game, opts) {
    this.game = game; this.o = opts;
    this.m = null; this.cook = null; this.scene = null;
    this.mPos = new THREE.Vector3(); this.cPos = new THREE.Vector3(COOK_AT[0], 0, COOK_AT[1]);
    this.key = null; this.lastT = 0; this.track = null; this.trackKey = '';
    this.out = { visible: false, x: 0, z: 0, h: 0, pose: 'stand', speed: 0, seg: -1 };
    this.heard = [];                    // test hook: [key, t, who, text] of lines shown here
    this.cookN = 0;
    game.interact.add({ place: ROOM, pos: () => this.mPos, radius: 1.8, label: () => `Talk to ${opts.label}`,
      enabled: () => !!(this.m && this.m.group.visible), onUse: () => opts.talk() });
    game.interact.add({ place: ROOM, pos: () => this.cPos, radius: 1.75, label: () => this.cookLabel(),
      enabled: () => !!(this.cook && this.cook.group.visible), onUse: () => this.talkCook() });
  }
  /** the meal on now in Hall (worcester_interiors.js timetable, honouring its test override) */
  meal() {
    const W = this.game.worcint, f = W && W.force && W.force.meal !== null && W.force.meal !== undefined ? W.force.meal : undefined;
    return f !== undefined ? f : hallMeal(this.o.day(), this.game.time.hour);
  }
  cookLabel() { const m = this.meal(); return m === 'lunch' || m === 'dinner' ? `Talk to the cook (plate of the day £${COOK_PRICE[m].toFixed(2)})` : 'Talk to the cook'; }
  talkCook() {
    const game = this.game, ui = game.ui, m = this.meal();
    const say = (pages) => { ui.dialog('Cook', pages); if (this.o.tell) this.o.tell(pages);      // (the other players in Hall hear her too: friends.js)
      if (game.voice && game.voice.followDialog) game.voice.followDialog('hall_cook', undefined, this.cook ? { pos: this.cook.group.position, ch: this.cook } : {}); };
    if (m !== 'lunch' && m !== 'dinner') { say([COOK_TALK.formal]); return 'formal'; }
    const price = COOK_PRICE[m];
    if (!((game.state.money || 0) >= price)) { say([COOK_TALK.hello, COOK_TALK.skint]); return 'skint'; }
    game.pay(-price);
    const p = game.player, flags = (game.state.flags = game.state.flags || {});
    p.drunk = eatEffects(flags, p.drunk, game.time.now()); game.save();
    const dish = menuItem(m, this.o.day(), 7 + this.cookN++);
    say([COOK_TALK.hello, COOK_TALK.served]);
    ui.toast(`A plate of ${dish}, eaten standing at the counter (£${price.toFixed(2)}). Energy restored.`, 4.5);
    return 'eaten';
  }

  _room() {
    const game = this.game, W = game.worcint, r = W && W.rooms && W.rooms.hall, def = game.interiors.get(ROOM);
    return r && r.R && def && def.scene ? { R: r.R, def } : null;
  }
  _adopt(g, scene) { if (g.parent !== scene) scene.add(g); }

  /** s = { trip, t (s into the indoor scene), taken (somebody is playing Miguel) } or null; called every frame */
  update(dt, s) {
    const game = this.game, inHall = game.player.place === ROOM, rm = inHall ? this._room() : null;
    if (!rm) {
      if (this.m) this.m.group.visible = false;
      if (this.cook) this.cook.group.visible = false;
      this.key = null;
      return;
    }
    const { R, def } = rm, scene = def.scene, ground = (x, z) => { const y = def.ground ? def.ground(x, z) : 0; return Number.isFinite(y) ? y : 0; };
    const pl = game.player.pos;
    // --- Miguel
    const end = s && s.trip ? halEnd(s.trip) : 0;
    const on = !!(s && s.trip && !s.taken && s.t >= 0 && s.t < end - 0.3);
    if (on && !this.m) { this.m = createCharacter(lookFor('miguel')); this.m.setLabel(this.o.label); this.m.group.visible = false; }
    if (this.m) {
      const ch = this.m, g = ch.group;
      if (!on) g.visible = false;
      else {
        this._adopt(g, scene);
        const tk = s.trip.key + '|' + this.o.day();
        if (tk !== this.trackKey) { this.trackKey = tk; this.track = halTrack(s.trip, halSeat(R, s.trip.day)); }
        const o = trackAt(this.track, s.t, this.out);
        if (!o.visible) g.visible = false;
        else {
          const wasHidden = !g.visible;
          g.visible = true;
          const y = o.pose === 'sit' ? 0 : ground(o.x, o.z);
          g.position.set(o.x, y, o.z); this.mPos.set(o.x, y, o.z);
          let dh = o.h - g.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
          g.rotation.y = wasHidden ? o.h : g.rotation.y + dh * Math.min(1, dt * 9);
          if (ch.pose !== o.pose && !(ch.pose === 'clap' && ch.poseDur)) ch.setPose(o.pose);
          const dx = pl.x - o.x, dz = pl.z - o.z, d = Math.hypot(dx, dz);
          const yaw = Math.atan2(Math.sin(Math.atan2(dx, dz) - g.rotation.y), Math.cos(Math.atan2(dx, dz) - g.rotation.y));
          ch.headTurn(d < 4 && o.pose !== 'talk' ? Math.max(-1.1, Math.min(1.1, yaw)) : 0);
          ch.update(dt, o.speed);
        }
      }
    }
    // --- the cook: at every meal, and whenever Miguel's scene is on
    const cookOn = !!this.meal() || on;
    if (cookOn && !this.cook) { this.cook = createCharacter(COOK_LOOK); this.cook.setLabel('Cook'); this.cook.voiceAs = 'hall_cook'; }
    if (this.cook) {
      const ch = this.cook, g = ch.group;
      g.visible = cookOn;
      if (cookOn) {
        const fresh = g.parent !== scene;
        this._adopt(g, scene);
        g.position.set(COOK_AT[0], ground(COOK_AT[0], COOK_AT[1]), COOK_AT[1]);
        const mAt = on && this.m && this.m.group.visible && s.t >= HAL_T.counter - 1 && s.t < HAL_T.leaveCounter;
        const want = mAt ? Math.atan2(this.m.group.position.x - COOK_AT[0], this.m.group.position.z - COOK_AT[1]) : COOK_FACE;
        let dh = want - g.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        g.rotation.y = fresh ? want : g.rotation.y + dh * Math.min(1, dt * 5);
        const want2 = mAt && s.t >= HAL_T.reply - 0.2 && s.t < HAL_T.reply + 3 ? 'talk' : 'stand';
        if (ch.pose !== want2) ch.setPose(want2);
        const dx = pl.x - COOK_AT[0], dz = pl.z - COOK_AT[1];
        const yaw = Math.atan2(Math.sin(Math.atan2(dx, dz) - g.rotation.y), Math.cos(Math.atan2(dx, dz) - g.rotation.y));
        ch.headTurn(!mAt && Math.hypot(dx, dz) < 4 ? Math.max(-1.0, Math.min(1.0, yaw)) : 0);
        ch.update(dt, 0);
      }
    }
    // --- the exchange: each line once per arrival, as t passes its moment (same moments for every player in Hall)
    if (!(s && s.trip)) { this.key = null; return; }
    // (a debug replay — screenshots — re-shows the lines of the last s.replay seconds, and keeps their bubbles up)
    if (this.key !== s.trip.key) { this.key = s.trip.key; this.lastT = s.t - (s.replay || 0); if (!s.replay) return; }
    const t0 = this.lastT; this.lastT = s.t;
    if (!on && s.t > HAL_T.happy + 1) return;
    for (const L of halLinesBetween(s.trip, t0, s.t)) this.say(L[1], L[2], s.replay ? 60 : L[3], s);
    if (s.trip.luck && t0 < HAL_T.clap && s.t >= HAL_T.clap && this.m && this.m.group.visible) this.m.setPose('clap', { duration: 2.2 });
  }

  say(who, text, secs, s) {
    const ch = who === 'cook' ? this.cook : this.m;
    this.heard.push([s.trip.key, +s.t.toFixed(2), who, text]); if (this.heard.length > 40) this.heard.shift();
    if (!ch || !ch.group.visible) return;
    const v = this.o.voices, pl = this.game.player.pos, g = ch.group.position, d = Math.hypot(pl.x - g.x, pl.z - g.z);
    if (who === 'cook') {
      const rt = v && v.rt, dur = rt && rt.duration('hall_cook', text);
      ch.say(text, Math.max(secs, (dur || 0) + 0.6));
      if (rt && rt.enabled && rt.has('hall_cook', text)) rt.say('hall_cook', text, { dist: d, interrupt: true, pos: g, ch });
    } else {
      ch.say(text, Math.max(secs, ((v && v.duration('miguel', text)) || 0) + 0.6));
      if (v) v.say('miguel', text, d, true, { pos: g, ch });
    }
  }
  /** test hook: the state of the two figures */
  state() {
    const f = (ch) => ch && { visible: ch.group.visible, x: +ch.group.position.x.toFixed(2), z: +ch.group.position.z.toFixed(2), pose: ch.pose, saying: ch.saying || null };
    return { miguel: f(this.m), cook: f(this.cook), heard: this.heard.slice() };
  }
}
