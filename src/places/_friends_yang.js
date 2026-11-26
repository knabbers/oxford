// Prof. Yang indoors + his catchphrases (owned by places/friends.js). His day (_friends_logic.js yangRoutine, on the
// shared clock) sometimes takes him into a Worcester room: the Porters' Lodge (pidges), his study for tutorials (the
// Memorial Room on odd game days, a Library desk on even days — GUESSES), and high table in Hall at lunch / dinner. While
// he is "in" a room the outdoor figure is hidden (friends.js SPOTS y*) and this module draws a second character in that
// room's scene, like Lorenzo in Tesco (_friends_tesco.js), with its own "[E] Talk to Prof. Yang".
//
// YangSpeech decides when he says one of the user's four catchphrases (_friends_logic.js YANG_LINES / yangLine): a line
// per shared YANG_SLOT_S slot (by slot index, so every client near him shows the same line at the same moment), and one
// when any player (local or remote, positions from game.net) walks up to him (line by the shared minute index).
import * as THREE from 'three';
import { createCharacter } from '../core/characters.js';
import { lookFor } from './_people.js';
import { YANG_SLOT_S, yangLine } from './_friends_logic.js';
import { WALK_UP as LIB_WALK_UP } from './_worcint_library_plan.js';

const WALKUP_R = 4.5, NEAR_R = 10, WALKUP_COOL_MS = 40000;

/** players (the local one and remote ones) in `place` within r of (x, z): count */
export function playersNear(game, place, x, z, r) {
  let n = 0;
  const p = game.player;
  if (p.place === place && Math.hypot(p.pos.x - x, p.pos.z - z) < r) n++;
  const others = game.net && game.net.others;
  if (others) for (const o of others.values()) if (o.seen !== false && o.place === place && Math.hypot(o.x - x, o.z - z) < r) n++;
  return n;
}

/** when to say what (one per figure: outdoors / indoors) */
export class YangSpeech {
  constructor() { this.slot = null; this.nearN = 0; this.walkT = -1e15; this.fresh = false; }
  /** fresh = the next step only notes who is already near (no walk-up line for them: outdoors, when he comes into view) */
  reset(fresh = false) { this.slot = null; this.nearN = 0; this.fresh = fresh; }
  /** now = game.time.now(); meal: eating in Hall; nearN: players within WALKUP_R; anyNear: someone within NEAR_R;
   *  busy: already talking / in a dialog. Returns the line to say now, or null. */
  step(now, { meal = false, nearN = 0, anyNear = false, busy = false }) {
    const k = Math.floor(now / (YANG_SLOT_S * 1000));
    let line = null;
    if (this.fresh) { this.fresh = false; this.nearN = nearN; }
    if (nearN > this.nearN && now - this.walkT > WALKUP_COOL_MS) {
      this.walkT = now;
      line = yangLine(meal ? 'walkupMeal' : 'walkup', Math.floor(now / 60000));
    }
    this.nearN = nearN;
    if (this.slot === null) this.slot = k;          // first frame near him: wait for the next slot boundary
    else if (k !== this.slot) { this.slot = k; if (!line) line = yangLine(meal ? 'meal' : anyNear ? 'near' : '', k); }
    return busy ? null : line;
  }
}

// where he sits / stands in each room (room builders' own anchors; see _worcint_*.js)
const PLACE = {
  // high table: seat 3 of 8 (seats 2 and 5 are the Fellows worcester_interiors.js puts there at meals)
  worcint_hall: (R) => { const s = R.highSeats[3] || R.highSeats[0]; return s && { x: s.x, z: s.z, h: s.h, pose: 'sit' }; },
  // a reading desk nobody else uses (students sit at i % 3 == 1, the player's "Sit and read" desks are i % 3 == 0)
  worcint_library: (R) => { const d = R.desks.find((_, i) => i % 3 === 2) || R.desks[0]; return d && { x: d.x, z: d.z, h: d.h, pose: 'write', via: LIB_WALK_UP }; },      // (via: the way up the round stair)
  // the head of the boardroom table (chair 16, facing down the table)
  worcint_memorial: (R) => { const c = R.chairs[16] || R.chairs[R.chairs.length - 1]; return c && { x: c.x, z: c.z, h: c.h, pose: 'sit' }; },
  // at the pigeonholes on the east wall, checking his post
  worcint_lodge: (R) => R.pidge && { x: R.pidge[0] - 0.1, z: R.pidge[1] + 1.2, h: Math.PI / 2, pose: 'stand' },
};
const KEY = { worcint_hall: 'hall', worcint_library: 'library', worcint_memorial: 'memorial', worcint_lodge: 'lodge' };
/** his spot in a room that has been built: { x, z, h, pose, y, scene } in the room's frame, or null (friends.js walks
 *  him between it and the room's real door when the room is a walk-in room) */
export function yangSpot(game, place) {
  const W = game.worcint, r = W && W.rooms && W.rooms[KEY[place]], def = game.interiors.get(place);
  if (!PLACE[place] || !r || !r.R || !def || !def.scene) return null;
  const s = PLACE[place](r.R);
  if (!s) return null;
  const y = def.ground ? def.ground(s.x, s.z) : 0;
  return { ...s, y: Number.isFinite(y) ? y : 0, scene: def.scene };
}

export class YangRooms {
  /** opts: { label, voices (FriendVoices), talk() (opens his [E] dialog), isMeal() } */
  constructor(game, opts) {
    this.game = game; this.o = opts;
    this.ch = null; this.room = null; this.spot = null; this.pos = new THREE.Vector3();
    this.speech = new YangSpeech();
    this.handles = Object.keys(PLACE).map((place) => game.interact.add({
      place, pos: () => this.pos, radius: 1.9, label: () => `Talk to ${opts.label}`,
      enabled: () => this.room === place && !!this.ch && this.ch.group.visible,
      onUse: () => opts.talk(),
    }));
  }
  /** the room he is drawn in now (null outdoors / not shown) */
  get shownIn() { return this.ch && this.ch.group.visible ? this.room : null; }

  _place(place) { return yangSpot(this.game, place); }

  /** n = Prof. Yang's friends.js record (n.inRoom, n.arrived, n.hold); called every frame */
  update(dt, n) {
    const game = this.game, place = game.player.place;
    // (a walk-in room is also seen from outside, through its windows and doorway, while it is shown)
    const rd = n && n.inRoom && n.arrived ? game.interiors.get(n.inRoom) : null, inside = !!rd && place === n.inRoom;
    const want = rd && (inside || (rd.sl && rd.sl.shown)) ? n.inRoom : null;
    if (!want) { if (this.ch) this.ch.group.visible = false; this.room = null; this.speech.reset(); return; }
    if (this.room !== want) {
      const s = this._place(want);
      if (!s) { if (this.ch) this.ch.group.visible = false; return; }
      if (!this.ch) { this.ch = createCharacter(lookFor('yang')); this.ch.setLabel(this.o.label); }
      const g = this.ch.group;
      s.scene.add(g);                                   // (re-parents from the previous room's scene)
      g.position.set(s.x, s.y, s.z); g.rotation.y = s.h;
      this.ch.setPose(s.pose);
      this.pos.set(s.x, s.y, s.z);
      this.room = want; this.spot = s; this.speech.reset();
    }
    const ch = this.ch, g = ch.group, s = this.spot, pl = game.player.pos;
    g.visible = true;
    if (ch.pose !== s.pose) ch.setPose(s.pose);
    const dx = pl.x - s.x, dz = pl.z - s.z, d = inside ? Math.hypot(dx, dz) : 99;
    // looks up at you when you come close
    const yaw = Math.atan2(Math.sin(Math.atan2(dx, dz) - s.h), Math.cos(Math.atan2(dx, dz) - s.h));
    ch.headTurn(d < 4 ? Math.max(-1.1, Math.min(1.1, yaw)) : 0);
    ch.update(dt, 0);
    // catchphrases (shared slots / walk-ups; only seen by players in this room)
    const meal = want === 'worcint_hall' && !!(this.o.isMeal && this.o.isMeal());
    const line = this.speech.step(game.time.now(), {
      meal, nearN: playersNear(game, want, s.x, s.z, WALKUP_R), anyNear: playersNear(game, want, s.x, s.z, NEAR_R) > 0,
      busy: n.hold || (!!n.rtalk && performance.now() < n.rtalk.until),      // (someone is talking to him — here or on another client; never "a box is open on our screen")
    });
    if (line) this.say(line, d);
  }

  say(text, d) {
    const v = this.o.voices;
    this.ch.say(text, Math.max(3, ((v && v.duration('yang', text)) || 0) + 0.8));
    if (v) v.say('yang', text, d, true, { pos: this.pos || this.ch.group.position, ch: this.ch });
  }
}
