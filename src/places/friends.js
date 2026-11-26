// Friends & tutors around Worcester College: one persistent NPC per person in places/_people.js, each with a daily
// routine keyed to the SHARED game clock (so every client sees them in roughly the same place), "[E] Talk" dialogue,
// greetings by name, and Kotaro's parkour runs on real street furniture / boundary walls near the college.
//
// Miguel sometimes cooks chicken dippers for Lorenzo and himself in the Earl Building ground-floor kitchen
// (_friends_dippers.js; schedule + scene timeline in _friends_logic.js): most days around 13:00 and/or 19:00–19:30, some
// nights ~00:30 after the bar. While they are in the kitchen they are hidden outdoors and whereIs() says so.
// Miguel says Hall as "hal" (the user) and often invites people to come with him to hal (_friends_logic.js HAL_*): on a
// meal with no dippers session of that kind he walks to the loggia outside the Hall door, waits there inviting people
// ([E] Go to hal with Miguel takes you in with him), goes in and asks the cook "Do you have any schicken deepers?"
// (_friends_hal.js draws him and the cook inside Hall). All on the shared clock; the player's "yes" is local.
// Friends' lines are spoken (pre-rendered clips via game.voice; a bubble only when a line can't be heard — core/voice.js, _friends_voice.js,
// docs/VOICES.md); V toggles all voices.
//
// game.friends = { roster, npcs, whereIs(id), taken(id), sessions(day), voices, debugLineup(x, z, h), debugParkour(route, t, fail),
//                  debugHour(h), debugDippers(stage | t, opts), debugGraph(), debugOff(), nightOut(day), debugKnock(id) }
// Tagging along (_friends_follow.js): a friend who is free now and then falls in with a player near them (likelier if you
// stop by them or talk to them), walks beside you, through doors after you, and leaves when their day calls or they have
// had enough; whereIs(id).following = the id of the player they are with ('solo' when not in a room) or null, and their
// spot is then 'follow' (so nobody seats them in the bar or shows them in the club). game.friends.follow = the crew
// (debugJoin(id), debugLeave(id, why), state(id)).
// Who hears what (multiplayer): everything a friend says aloud is said on EVERY client that has a player in earshot, at
// the same moment, from where the friend stands.
//   shared slot   ambient catchphrases, Miguel's line to Aiken, the chatter of a group, hal invitations, Prof. Yang, the
//                 lines of someone walking with a player: one chance per slot of the shared clock, decided from things
//                 every client has (the slot, the friend, where ANY player is, who is being talked to) — never from the
//                 local player's own screen (a dialog open, a bubble still up).
//   owned + sent  what one player sets off: the [E] Talk conversation ('friendTalk': each page as its owner turns to it;
//                 the others see the friend turn to that player, stand still and say the same pages; two players
//                 pressing E on one friend: the earlier press on the shared clock keeps it, then the lower id, and the
//                 other's box closes), a greeting by name as a player walks up, "Ow! <name>!" with the tumble itself,
//                 Miguel's "Boa! To hal, then." and his nudge, Lorenzo's duck line ('friendLine').
//   private       the hal OFFER prompt ("[E] Go to hal with Miguel") and its objective text; the chicken-dippers session
//                 a player who is playing Miguel starts himself in the kitchen (his own client only: _friends_dippers.js).
// With voices off (the sound panel) every one of these still shows as a bubble: a line is always Character.say().
// Friends are solid (soft circle against the player) and a bike / car bump knocks them over like pedestrians.
// Nights out (_friends_logic.js nightOut): on ~half the game nights 2–4 friends are 'town' from ~22:30 to ~02:30 (the
// Purple Turtle shows them inside); a late dippers session brings Miguel and Lorenzo home from the club for it.
//   whereIs(id) -> { id, x, y, z, spot, inBar, inEarlKitchen, place, indoor (walk-in room he is walking through), hidden, walking, taken } — the bar module can seat
//   people whose inBar is true.
// A person is hidden while any player (local or remote) is playing them (look.friend === id, see main.js "Play as").
// Prof. Yang's day changes with the game day (_friends_logic.js yangRoutine): Lodge, his study (Memorial Room / Library),
// high table at meals (drawn inside those rooms by _friends_yang.js; whereIs(...).place / .inRoom say which), and walks
// along Beaumont Street or Walton Street. He says the user's four catchphrases (YANG_LINES), voiced (PEOPLE.voiced).
import * as THREE from 'three';
import { createCharacter } from '../core/characters.js';
import { PEOPLE, lookFor, personOf } from './_people.js';
import { ROUTINE, personTimeline, entryAt, dipperSessions, nightOut, tescoTrips, DUR_S, GUEST_IN_S, SHOP_ID, SHOP_S, YANG_ROOMS, yangLine, yangRoutine } from './_friends_logic.js';
import { FriendVoices } from './_friends_voice.js';
import { DippersScene } from './_friends_dippers.js';
import { TescoVisit } from './_friends_tesco.js';
import { YangRooms, YangSpeech, playersNear, yangSpot } from './_friends_yang.js';
import { meal as hallMeal } from './_worcint_logic.js';
import { halTrips, halInvite, HAL_SLOT_S, HAL_ACCEPT, HAL_DOOR_S, HAL_INVITE, COOK_REPLY, COOK_LUCK, halMealWindow } from './_friends_logic.js';
import { HalScene, HAL_DOOR_IN } from './_friends_hal.js';
import { mkLeg, legAt, earlLeg, earlLegIn, kitchenWindow, EARL_ID, DOOR_INTENT_V } from './_friends_logic.js';
import { FollowCrew, SOCIABLE, GAIT_MAX } from './_friends_follow.js';
import { seatAt, seatCount } from '../systems/sitting.js';

import { DAY_MS, HOUR_S } from '../core/time.js';      // HOUR_S: real seconds in a game hour (timeline hours <-> scene seconds)
const VIS_FAR = 150, ANIM_FAR = 90;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const angTo = (dx, dz) => Math.atan2(dx, dz);
function hash01(n) { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); }

// ------------------------------------------------------------------------------------------------ walking graph
// Hand-authored from the OSM footways around Worcester (map.json roads), paths only: never across the Main Quad lawn.
const N = {
  // (2026-11-22, second pass: the main block at its true plan — places/_worcester_shared.js WORC_BLOCK: the gate hall
  //  (LODGE its middle), the loggia 4.9 m deep (LOG_N / LOG_S: opposite its first and last arches, LOG_M on the gate's
  //  axis), the Hall door's landing 0.3 m up (HALL_D on it, HALL_W at the foot of its step))
  GATE_OUT: [-219.0, 8.6], FORE: [-229.37, 9.63], LODGE: [-239.04, 10.37],
  LOG_N: [-245.67, -4.23], LOG_M: [-244.52, 10.79], LOG_S: [-243.38, 25.80],
  QN_E: [-255.0, -5.2], QN_M: [-275.90, -4.77], QN_W: [-298.5, -3.4], QW: [-300.1, 6.5],
  QS_E: [-256.93, 28.88], QS_W: [-298.0, 31.2],
  // (2026-11-22, the college's real levels — places/worcester.js LEVELS: the way from the loggia down to the quad's
  //  south path is the fan of steps outside the last arch (FAN_T its landing, FAN_F its foot), and Pump Quad is
  //  entered from that path through the gap by the Cottages' corner (GAP_N), not by a flight from the loggia's end;
  //  the Cellar Bar's stair starts at the court's north-east corner (PQ_BAR its head, PQ_E the flags beside it))
  FAN_T: [-247.40, 25.75], FAN_F: [-247.31, 29.45], FAN_W: [-251.48, 30.07], GAP_N: [-246.12, 29.91],      // (GAP_N: in the 2.1 m passage between the block's south face and the Cottages' gable)      // (FAN_F: between its two handrails; FAN_W: on the path west of it)
  // (PQ_W: just inside the gap; PQ_C: on the flags under the glazed lean-to, the way out to the gravel between its posts)
  // (stage B, the court as the fire plan and LIDAR have it: PQ_X under the canopy's west end, clear of its posts; PQ_E on the
  //  gravel south of the bar's flight, PQ_BAR at its head, under the canopy's eaves: places/_bar_out.js OUT_PATH goes on down)
  PQ_W: [-244.45, 30.14], PQ_X: [-243.29, 32.25], PQ_C: [-240.30, 32.03], PQ_M: [-238.46, 36.4], PQ_E: [-229.29, 33.69], PQ_BAR: [-229.35, 32.90],
  TUN_N: [-256.3, 32.6], TUN_S: [-254.8, 45.4], NUF_0: [-254.2, 49.8], NUF_0B: [-260.0, 46.0], NUF_1: [-266.0, 44.4], NUF_M: [-286.0, 46.0], NUF_W: [-312.0, 45.0], NUF_X: [-336.0, 44.0],
  LAKE_S2: [-336.0, 30.0], LAKE_S: [-336.0, 22.0], LAKE_P: [-344.0, 22.0], LAKE_A2: [-318.3, 19.0], LAKE_A: [-319.5, 2.0],      // (on the gravel walk beside the yew columns: places/worcester_gardens.js moves the mapped walk there)
  // the south bank of the lake along the edge of Nuffield Lawn (2–5 m from the water; the 'south bank' feed spot is LS_B)
  LS_1: [-358.0, 38.6], LS_2: [-386.0, 37.0], LS_B: [-400.0, 40.2], LS_W: [-412.0, 43.4],
  PG_G: [-305.5, 4.9], PG_1: [-306.0, 0.9],      // (PG_1: on the mapped path north of the rose garden's yew columns, which stand across the garden's north end: places/_wgard_build.js ROSE)
  WS_A: [-218.6, -4.0], WS_B: [-221.6, -16.5], WS_C: [-223.6, -35.0], WS_D: [-224.2, -45.0], WS_E: [-226.2, -80.0], WS_F: [-228.4, -116.0],
  WS_G: [-229.2, -146.0], WP_1: [-260.0, -152.6], WP_2: [-313.0, -148.3], WP_3: [-352.0, -143.2], WP_G: [-360.0, -137.6], GATE3: [-364.1, -134.2],
  WG_IN: [-372.0, -133.0], ST1: [-380.0, -132.0], ST2: [-382.0, -125.0], ST3: [-391.0, -124.0], BR_E: [-392.5, -132.8], BR_W: [-403.6, -131.75],      // (BR_E, BR_W: on the centre line of the Shah Centre's timber deck, which is 3.0 m wide and not on z = -133: places/_snsc_plan.js DECK)
  FN: [-417.0, -132.0], FIELDS: [-466.0, -82.0],
  PL_1: [-232.0, -48.4],
  GG_A: [-183.0, 58.3], GG_B: [-160.5, 61.5], GG_C: [-163.5, 79.0], GG_D: [-153.0, 78.0], GG_E: [-145.0, 79.5], GG_F: [-140.0, 86.0], GG_G: [-138.0, 112.0],
  GG_P: [-135.4, 119.8],
  // Earl Building: the footway from the bridge to its south tip (OSM w721939491). (The garden footways toward it cross
  // the garden wall w999275854 where the map has no gap, so friends go round by Worcester Place.)
  EARL_D: [-390.7, -161.9],      // (the paved garden before the Earl Building's canopy: the automatic door; 2026-11-22: the door is under the canopy on the wing's east side, as the architects' plan has it)
  EARL_G: [-388.3, -143.0],      // (the way there: round the Gym's south-east corner)
  EARL_P: [-393.4, -139.4],      // (the foot of the paved path to the Shah Centre's entrance: round the corner of its pool, places/worcester_snsc.js)
  CR_W: [-217.5, 21.5], CR_E: [-209.5, 22.6], ES_1: [-210.0, 31.0], ES_2: [-210.0, 47.0], GL_1: [-199.0, 50.5], GL_2: [-190.0, 51.5], GL_3: [-189.0, 58.2],
  // Prof. Yang: outside the Lodge, Hall and Library doors (worcester_interiors.js DOORS, on the existing passage /
  // loggia lines); through the Terrace passage (bay 1, OSM w164759807) into Provost's Yard to the Memorial Room door;
  // the south pavement of Beaumont Street (towards St Giles'); Walton Street's west pavement north of Worcester Place
  LDG_D: [-238.91, 9.46], HALL_D: [-241.74, 22.36], HALL_W: [-243.23, 22.47], LIB_D: [-238.76, 11.45],
  // (2026-11-22: Provost's Yard as rebuilt, places/_worcester_yard_plan.js YARD_WAYS / YARD_MARKS, each leg checked against
  //  the colliders: out of the Terrace's passage under the veranda (PY_B), clear of the low range's corner (PY_C), to the
  //  Memorial Room's doors (MEM_O); and across the yard round its planters (PY_M, PY_E), through the Besse archway
  //  (BES_S, BES_N) to the Orchard side (ORCH) and along the drive (DRV_1 .. 3) to the bike stands inside Gate 2 —
  //  Gate 2 on Walton Street is SHUT, so PL_1 is reached from inside the college)
  // (2026-11-23: the Terrace rebuilt — the level passage at its old bay 1 is gone; the way north is STAIRCASE 6: in at
  //  its doorway on the walk (PY_A), a hall two steps up (S6_H), east to the head of the flight (S6_T), down inside the
  //  range to the yard's level (S6_F), out by the yard door under the veranda (PY_B, PY_C): _worcester_terrace_plan.js TERR_MARKS)
  PY_A: [-295.72, -4.77], S6_H: [-295.99, -8.21], S6_T: [-293.62, -8.39], S6_F: [-294.13, -15.02], PY_B: [-294.28, -17.01], PY_C: [-294.42, -18.86], MEM_O: [-297.91, -34.39],
  PY_M: [-291.52, -22.94], PY_E: [-290.18, -31.57], BES_S: [-293.46, -35.18], BES_N: [-294.46, -48.24], ORCH: [-295.72, -53.01], DRV_1: [-284.78, -51.53], DRV_2: [-268.11, -51.30], DRV_3: [-249.46, -48.71],
  BM_0: [-201.0, 13.5], BM_1: [-164.0, 11.2], BM_2: [-120.0, 8.6], BM_3: [-98.0, 7.6],
  WN_1: [-232.6, -190.0],
};
const E = [
  ['GATE_OUT', 'FORE'], ['FORE', 'LODGE'], ['LODGE', 'LOG_M'], ['LOG_M', 'LOG_N'], ['LOG_M', 'LOG_S'],
  ['LOG_N', 'QN_E'], ['QN_E', 'QN_M'], ['QN_M', 'QN_W'], ['QN_W', 'QW'], ['QW', 'QS_W'], ['QS_W', 'QS_E'], ['QS_E', 'FAN_W'], ['FAN_W', 'FAN_F'], ['FAN_F', 'FAN_T'], ['FAN_T', 'LOG_S'],
  ['FAN_F', 'GAP_N'], ['GAP_N', 'PQ_W'], ['PQ_W', 'PQ_X'], ['PQ_X', 'PQ_C'], ['PQ_C', 'PQ_M'], ['PQ_C', 'PQ_E'], ['PQ_M', 'PQ_E'], ['PQ_E', 'PQ_BAR'],
  ['QS_E', 'TUN_N'], ['TUN_N', 'TUN_S'], ['TUN_S', 'NUF_0'], ['NUF_0', 'NUF_0B'], ['NUF_0B', 'NUF_1'], ['NUF_1', 'NUF_M'], ['NUF_M', 'NUF_W'], ['NUF_W', 'NUF_X'],
  ['NUF_X', 'LAKE_S2'], ['NUF_X', 'LS_1'], ['LS_1', 'LS_2'], ['LS_2', 'LS_B'], ['LS_B', 'LS_W'], ['LAKE_S2', 'LAKE_S'], ['LAKE_S', 'LAKE_P'], ['LAKE_S', 'LAKE_A2'], ['LAKE_A2', 'LAKE_A'],
  ['PG_G', 'PG_1'], ['PG_1', 'LAKE_A'],      // (not from QW any more: the door in the quad's west wall is shut — worcester.js WEST SIDE)
  ['GATE_OUT', 'WS_A'], ['WS_A', 'WS_B'], ['WS_B', 'WS_C'], ['WS_C', 'WS_D'], ['WS_D', 'WS_E'], ['WS_E', 'WS_F'], ['WS_F', 'WS_G'],
  ['WS_G', 'WP_1'], ['WP_1', 'WP_2'], ['WP_2', 'WP_3'], ['WP_3', 'WP_G'], ['WP_G', 'GATE3'], ['GATE3', 'WG_IN'], ['WG_IN', 'ST1'], ['ST1', 'ST2'], ['ST2', 'ST3'],
  ['ST3', 'BR_E'], ['BR_E', 'BR_W'], ['BR_W', 'FN'], ['FN', 'FIELDS'],
  ['BR_E', 'EARL_P'], ['EARL_P', 'EARL_G'], ['EARL_G', 'EARL_D'],
  ['GATE_OUT', 'CR_W'], ['CR_W', 'CR_E'], ['CR_E', 'ES_1'], ['ES_1', 'ES_2'], ['ES_2', 'GL_1'], ['GL_1', 'GL_2'], ['GL_2', 'GL_3'],
  ['GL_3', 'GG_A'], ['GG_A', 'GG_B'], ['GG_B', 'GG_C'], ['GG_C', 'GG_D'], ['GG_D', 'GG_E'], ['GG_E', 'GG_F'], ['GG_F', 'GG_G'], ['GG_G', 'GG_P'],
  ['FORE', 'LDG_D'], ['LDG_D', 'LODGE'], ['LOG_M', 'HALL_W'], ['HALL_W', 'HALL_D'], ['HALL_W', 'LOG_S'], ['LDG_D', 'LIB_D'],
  ['QN_W', 'PY_A'], ['PY_A', 'S6_H'], ['S6_H', 'S6_T'], ['S6_T', 'S6_F'], ['S6_F', 'PY_B'], ['PY_B', 'PY_C'], ['PY_C', 'MEM_O'],
  ['PY_C', 'PY_M'], ['PY_M', 'PY_E'], ['PY_E', 'BES_S'], ['BES_S', 'BES_N'], ['BES_N', 'ORCH'], ['ORCH', 'DRV_1'], ['DRV_1', 'DRV_2'], ['DRV_2', 'DRV_3'], ['DRV_3', 'PL_1'],
  ['GATE_OUT', 'BM_0'], ['CR_E', 'BM_0'], ['BM_0', 'BM_1'], ['BM_1', 'BM_2'], ['BM_2', 'BM_3'], ['WS_G', 'WN_1'],
];

// ------------------------------------------------------------------------------------------------ spots
// centre, ellipse radii for the conversation ring, pose while there, face (heading for someone alone; null = face centre)
const SPOTS = {
  lodge:    { node: 'FORE', c: [-230.5, 8.6], r: [1.1, 0.9], pose: 'talk', face: -Math.PI / 2 },
  quadN:    { node: 'QN_M', c: [-275.88, -4.57], r: [1.3, 0.6], pose: 'talk', face: 0 },
  stairs:   { node: 'QN_E', c: [-258.5, -4.7], r: [0.9, 0.5], pose: 'stand', face: Math.PI },
  loggia:   { node: 'LOG_M', c: [-244.50, 13.79], r: [0.5, 1.3], pose: 'talk', face: -Math.PI / 2 },
  pump:     { node: 'PQ_M', c: [-238.46, 36.4], r: [1.25, 1.9], pose: 'talk', face: Math.PI / 2 },
  bar:      { node: 'PQ_BAR', hidden: true, door: true },
  lake:     { node: 'LAKE_P', c: [-344.0, 21.6], r: [0.9, 1.2], pose: 'stand', face: -Math.PI / 2 },
  // Lorenzo's morning stroll up and down the south bank, past the 'south bank' feed spot, to where a few mallards
  // usually sit just offshore (the flock spawns there and barely drifts), pausing at each end facing the water
  // (2026-11-22: the old gateway stands on this path now, places/worcester_lake.js: he walks square through its opening)
  lakeside: { node: 'LS_W', stroll: [[-412.0, 43.4], [-418.7, 49.4], [-421.3, 49.2], [-423.7, 49.0], [-431.5, 40.6]], pose: 'stand', face: Math.PI, faceEnd: 2.6 },
  nuffield: { node: 'NUF_M', c: [-285.0, 50.5], r: [1.5, 1.0], pose: 'sitground', face: Math.PI },
  fields:   { node: 'FIELDS', c: [-468.0, -80.0], r: [1.6, 1.2], pose: 'sitground', face: Math.PI / 2 },
  walton:   { node: 'WS_E', c: [-226.4, -72.0], r: [0.25, 1.2], pose: 'phone', face: Math.PI },
  home:     { node: 'QN_E', hidden: true },          // their staircase on the north side of Main Quad
  town:     { node: 'GATE_OUT', hidden: true },      // out through the lodge into town
  gone:     { node: 'GATE_OUT', hidden: true },      // tutors: off to the department / home
  earl:     { node: 'EARL_D', hidden: true, door: true },             // off to the Earl Building (chicken dippers)
  earlIn:   { node: 'EARL_D', hidden: true, door: true, kitchen: true },   // in the Earl ground-floor kitchen
  shop:     { node: 'GATE_OUT', hidden: true, door: true },           // Lorenzo's Tesco run (out of the main gate)
  shopW:    { node: 'GATE3', hidden: true, door: true },              // ... by Worcester Place, straight from the Earl kitchen
  parkourA: { node: 'WS_A', parkour: 0 },
  parkourB: { node: 'PL_1', parkour: 1 },
  parkourC: { node: 'GG_P', parkour: 2 },
  // Prof. Yang (_friends_logic.js yangRoutine): in a Worcester room (hidden outdoors, drawn inside by _friends_yang.js) …
  yLodge:   { node: 'LDG_D', hidden: true, door: true, room: YANG_ROOMS.yLodge },
  yHall:    { node: 'HALL_D', hidden: true, door: true, room: YANG_ROOMS.yHall },
  yLib:     { node: 'LIB_D', hidden: true, door: true, room: YANG_ROOMS.yLib },
  yMem:     { node: 'MEM_O', hidden: true, door: true, room: YANG_ROOMS.yMem },
  // … or off along Beaumont Street towards St Giles' / Parks Road, or up Walton Street (hidden at the far end)
  yBeau:    { node: 'BM_3', hidden: true },
  yWalN:    { node: 'WN_1', hidden: true },
  // Miguel's hal (_friends_logic.js halTrips): waiting in the loggia beside the Hall door, inviting people …
  halGo:    { node: 'HALL_W', c: [-243.38, 23.13], r: [0.15, 0.15], pose: 'stand', face: -Math.PI / 2 },
  // … then in Hall (hidden outdoors; _friends_hal.js draws him inside)
  halIn:    { node: 'HALL_D', hidden: true, door: true, room: 'worcint_hall' },
};

// Walk-in rooms (core/interiors.js "seamless"): a hidden door spot whose room is registered as a walk-in room is WALKED
// into through its real door (and out again) instead of vanishing at the door node: see "walk-in legs" in install().
// The room of a spot: SPOTS[spot].room, or this table.
const WALKIN = { earl: EARL_ID, earlIn: EARL_ID, bar: 'worcester_bar' };
const roomOfSpot = (spot) => WALKIN[spot] || SPOTS[spot].room || null;
const ROOM_IDS = [...new Set(Object.keys(SPOTS).map(roomOfSpot).filter(Boolean))];
// routines (hour, spot) live in _friends_logic.js (ROUTINE) so the schedule can be smoke-tested headless.
const WALK_SPEED = { matt: 1.45, miguel: 1.3, aiken: 1.35, taskeen: 1.3, lorenzo: 1.3, dina: 1.25, james: 1.3, kotaro: 1.5, yang: 1.15, goldsmith: 1.05, earl: 1.2 };

// ------------------------------------------------------------------------------------------------ dialogue
// {name} = the player's name. First names only; tutors' lines stick to their public fields.
const LINES = {
  // light touches only: a word of their own language now and then (Miguel pt, Lorenzo it, Kotaro ja), British idiom
  // for Aiken and Matt, plain English for Taskeen. No phonetic spelling.
  matt: ['Alright {name}? Cellar Bar later?', 'Being 196 centimetres tall means I see everything first. Mostly the tops of doorframes.',
    'Lost the group? Just look for the tallest head in the quad.', 'Essay\u2019s due tomorrow. Plan: worry about it, beautifully, all day.',
    'I\u2019m absolutely knackered. Worth it, though.'],
  // (Miguel says Hall as "hal": the user. Every line of his writes it so; see _friends_logic.js HAL_*)
  miguel: ['Olá {name}! Hal tonight, or are we getting pizza?', 'Have you seen Kotaro? Last time I saw him he was standing on top of a wall. Normal.',
    'I\u2019m going to sit here and pretend the reading list doesn\u2019t exist.', 'Pump Quad later, pá? Everyone ends up there anyway.',
    'If you\u2019re near the Earl Building at lunchtime, follow the smell. Chicken dippers. You\u2019re welcome.',
    // the user's own catchphrases for Miguel (M'Jumbo = the user's darts nickname, _bar_roster.js)
    "How many M'Jumbos?", "Who is M'Jumbo, James?", 'Mmmm, shicken deepers.', 'I think I\u2019ll be going to my room.',
    'Aiken, would you like some belly jeans?',
    // more of the user's catchphrases for Miguel, verbatim as given (sent to the voice renderer exactly as written)
    "who is magumbo james die", "i live on bewmont street", "OMIGUEL!", "i wish i was eating some shicken deepers right now",
    // the user's own recordings (tools/voices/recordings/miguel/), text as he captioned them
    "Ayken, do you want some shicken deepers?", "Ey Lorenzo, do you want some shicken deepers?", "I hope they're serving shicken deepers tonight at hal.", "I think I'll be going to my room.", "Niiiiice", "Omiguel!", "how many mugumbos apply for university", "who is ... mugumbo mugumbo mugumbo", "who is mugumbo james die", "Who is... magumbo magumbo magumbo", "Shall we?"],
  aiken: ['Oh, hey {name}. You alright?', 'The hat stays on. It\u2019s basically part of me now.', 'If you\u2019re heading to the bar, save us a seat, yeah?',
    'I was going to be productive today. Then the sun came out. Typical.'],
  taskeen: ['Hi {name}! Have you done the reading? ...No? Me neither.', 'Pump Quad at seven, yes? Don\u2019t be late this time.',
    'If you need Matt, just look up.', 'I have three deadlines and one working pen. It\u2019s fine.',
    // the user's catchphrase tag for Taskeen: an innocent remark, then "...in more ways than one!"
    'This reading list is heavy going. ...in more ways than one!', 'Matt is head and shoulders above the rest of us. ...in more ways than one!',
    'Kotaro is always on top of things. ...in more ways than one!', 'Miguel\u2019s cooking really sets the kitchen alight. ...in more ways than one!'],
  lorenzo: ["not bahd", 'Ciao {name}! Coffee first, thinking later.', 'Is it just me, or does every path in this college lead to the bar?',
    'I\u2019m told the lake is beautiful at this time of day. I\u2019m also told I have a tutorial.', 'Dai, come and find us in Pump Quad later.',
    'If Miguel offers you chicken dippers, say yes. Trust me.', "if we don't start now, brrrrrrrrrrr, MIDNIGHT!"],
  dina: ['Hello {name}! Are you coming to hall?', 'Ignore the outfit, it has been a long day.',
    'The gardens are the best thing about this place. Do not tell the library.', 'Bar later? Good. I will hold you to that.'],
  james: ['Hey {name}. Snacks? I have emergency rations in my bag.', 'The scarf stays on until at least June.',
    'Library or bar? ...Bar. Obviously.', 'If you see my glasses on my head, please tell me before I go looking for them.'],
  kotaro: ['Want to see something? Watch the wall.', 'Parkour is just walking, with more opinions about walls.',
    'The trick is to look where you are landing, not where you are.', 'Every bike stand in Oxford is a training partner if you believe.',
    'Warm up first. Walls do not care about your hamstrings.'],
  yang: ['Ah, {name}. Good to see you. Are you keeping up with the problem sheets?',
    'A question, since we are here: if a program can flip a coin, what does it mean for it to be correct? Think of its output as a distribution, not a single answer.',
    'In separation logic we reason about memory one piece at a time, and leave the rest alone. A useful habit in general.',
    'Probabilistic programming: write the model as a program and let inference do the rest. Mostly.',
    'Try this before your next tutorial: why does a type system help you prove things about a program before you run it?'],
  goldsmith: ['Good day, {name}. Have you changed your password recently? No? Today is a fine day for it.',
    'Here is one for you: two processes each wait for the other to speak first. What do we call that? ...Deadlock. Quite so.',
    'Most security failures are not clever attacks. They are small assumptions nobody wrote down.',
    'A security protocol is only as strong as its weakest message. We used to find the flaws by modelling everyone as communicating processes, the attacker included.'],
  earl: ['Ah, {name}. Your problem sheet is due on Friday, I believe.',
    'Quick question: is the square root of two rational? ...No. And you should be able to prove it before lunch.',
    'Completeness of the reals: every non-empty set bounded above has a least upper bound. Remember that one.'],
};
const GREET = { friend: ['Hey {name}!', '{name}!', 'Oh hi {name}!'], prof: ['Hello, {name}.', 'Good afternoon, {name}.'], tutor: ['Hello, {name}.'] };
// per-friend greetings (fall back to GREET.friend)
const GREET_BY = {
  miguel: ['Olá {name}!', 'Hey {name}!', 'Olá, olá! Tudo bem, {name}?'], lorenzo: ['Ciao {name}!', 'Ehi, {name}!', 'Hey {name}!'],
  kotaro: ['Hey {name}!', 'Yo, {name}!'], aiken: ['Alright {name}?', 'Hiya {name}!', 'Oh, hey {name}.'], matt: ['Alright {name}?', '{name}! Alright, mate?', 'Hiya {name}!'],
  taskeen: ['Hi {name}!', 'Oh hi {name}!', 'Hey {name}!'],
};
// Catchphrases (the user's in-jokes). CATCH.lorenzo.duck: within DUCK_R of a duck (Worcester lake or the Parks pond),
// at most once per DUCK_COOL_S. CATCH.miguel.home: as he sets off for the Earl Building (his room) at the end of the
// evening. CATCH.lorenzo.late (the user's words, exactly): his evening line, now and then after 21:00 (AMBIENT, gated by
// AMBIENT_HOURS) and as the dinner-time chicken-dippers session gets going (_friends_logic.js SCENE_LINES 'evening').
// AMBIENT: said now and then (every ~AMB_S) when the player is near; all are also in their LINES.
// join / leave / must / car: the few plain lines of someone tagging along with you (_friends_follow.js): falling in,
// having had enough, being called away by their day, and being offered a car you took. The same words for everyone
// (nothing personal is invented); Miguel leaving for hal, for chicken dippers or for bed says his own lines instead.
const CATCH = {
  lorenzo: { duck: ['That duck looks like it would fit well in an oh-ven.'], late: ["if we don't start now, brrrrrrrrrrr, MIDNIGHT!"],
    join: ['Where are we going?', 'I\u2019ll come with you.'], leave: ['Right, I\u2019m off.'], must: ['I\u2019ve got to go. See you later.'], car: ['I\u2019m not getting in that.'] },
  miguel: { home: ['I think I\u2019ll be going to my room.'],
    join: ['Where are we going?', 'I\u2019ll come with you.'], leave: ['Right, I\u2019m off.'], must: ['I\u2019ve got to go. See you later.'], car: ['I\u2019m not getting in that.'] },
  matt: { join: ['Where are we going?', 'I\u2019ll come with you.'], leave: ['Right, I\u2019m off.'], must: ['I\u2019ve got to go. See you later.'], car: ['I\u2019m not getting in that.'] },
  aiken: { join: ['Where are we going?', 'I\u2019ll come with you.'], leave: ['Right, I\u2019m off.'], must: ['I\u2019ve got to go. See you later.'], car: ['I\u2019m not getting in that.'] },
  taskeen: { join: ['Where are we going?', 'I\u2019ll come with you.'], leave: ['Right, I\u2019m off.'], must: ['I\u2019ve got to go. See you later.'], car: ['I\u2019m not getting in that.'] },
  dina: { join: ['Where are we going?', 'I\u2019ll come with you.'], leave: ['Right, I\u2019m off.'], must: ['I\u2019ve got to go. See you later.'], car: ['I\u2019m not getting in that.'] },
  james: { join: ['Where are we going?', 'I\u2019ll come with you.'], leave: ['Right, I\u2019m off.'], must: ['I\u2019ve got to go. See you later.'], car: ['I\u2019m not getting in that.'] },
  kotaro: { join: ['Where are we going?', 'I\u2019ll come with you.'], leave: ['Right, I\u2019m off.'], must: ['I\u2019ve got to go. See you later.'], car: ['I\u2019m not getting in that.'] },
};
// what Miguel says instead when it is hal / chicken dippers that calls him away (his own lines, as they are)
const MIGUEL_OFF = { hal: 'I\u2019m going to hal. Coming, pá?', dip: 'i wish i was eating some shicken deepers right now' };
// said now and then by someone walking with you who has no AMBIENT lines of their own: their ordinary lines (not the ones that name you)
const FOLLOW_AMB_S = 42;
const AMBIENT = {
  lorenzo: ["if we don't start now, brrrrrrrrrrr, MIDNIGHT!", "not bahd"],
  miguel: ["How many M'Jumbos?", "Who is M'Jumbo, James?", 'Mmmm, shicken deepers.', 'I think I\u2019ll be going to my room.', 'Aiken, would you like some belly jeans?',
    "who is magumbo james die", "i live on bewmont street", "OMIGUEL!", "i wish i was eating some shicken deepers right now",
    // the user's own recordings (tools/voices/recordings/miguel/), text as he captioned them
    "Ayken, do you want some shicken deepers?", "Ey Lorenzo, do you want some shicken deepers?", "I hope they're serving shicken deepers tonight at hal.", "I think I'll be going to my room.", "Niiiiice", "Omiguel!", "how many mugumbos apply for university", "who is ... mugumbo mugumbo mugumbo", "who is mugumbo james die", "Who is... magumbo magumbo magumbo", "Shall we?"],
  taskeen: ['This reading list is heavy going. ...in more ways than one!', 'Matt is head and shoulders above the rest of us. ...in more ways than one!',
    'Kotaro is always on top of things. ...in more ways than one!', 'Miguel\u2019s cooking really sets the kitchen alight. ...in more ways than one!'],
};
const DUCK_R = 6, DUCK_COOL_S = 50, AMB_S = 55;
// Miguel's question to Aiken (the user's words, exactly): one of his AMBIENT lines like the rest, and the likely one
// (half his ambient slots) while Aiken is within TO_AIKEN_R of him; where the two are is the shared clock's doing, so
// every client agrees
const TO_AIKEN = 'Aiken, would you like some belly jeans?', TO_AIKEN_R = 12;
/** hours an ambient line can come, and how likely per slot (default: any time, 0.8) */
const AMBIENT_HOURS = {};
/** a line that only comes at certain hours (Lorenzo's midnight line: evenings); the rest of a speaker's ambient lines come at any time */
const LINE_HOURS = { "if we don't start now, brrrrrrrrrrr, MIDNIGHT!": [21, 24], "I hope they're serving shicken deepers tonight at hal.": [12, 19.5] };
const ambAt = (amb, hour) => { const o = amb.filter((t) => { const h = LINE_HOURS[t]; return !h || (hour >= h[0] && hour < h[1]); }); return o.length ? o : amb; };
const greetsFor = (n) => GREET_BY[n.id] || GREET[n.P.kind] || GREET.friend;
const KOTARO_SAY = { start: ['Yosh! Watch this.', 'Okay, one more run.', 'Here goes.'], done: ['Sugoi... that one was clean.', 'Clean!', 'Yes!'],
  fail: ['I meant to do that.', 'Ow. Fine. Fine!', 'The wall moved.'] };

// ------------------------------------------------------------------------------------------------ parkour routes
// Built at install from real map data: the Walton Street college boundary wall (OSM w999276231, 2.6 m + coping), the
// Sheffield bike stands on Provost's Lane (n1807845503, 0.8 m; parked bikes either side) and the bollard north of
// Gloucester Green (n6863361940, 0.85 m).
// Segment: [kind, ...] -> compiled {k, x0,z0,y0, x1,z1,y1, t0, dur, ...}.
const WALL_TOP = 2.6 + 0.12;
const STAND_TOP = 0.8;

function wallPoint(pts, s, off) {     // point at arc length s along polyline pts, offset `off` to the right of travel
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + l >= s || i === pts.length - 2) {
      const t = clamp((s - acc) / l, 0, 1), dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l;
      return [a[0] + (b[0] - a[0]) * t - dz * off, a[1] + (b[1] - a[1]) * t + dx * off];
    }
    acc += l;
  }
  return pts[0];
}

function buildRoutes(game) {
  const map = game.map, routes = [];
  const stands = (game.world && game.world.bikeStands) || [];
  const standsOf = (poi) => stands.filter((s) => s.poi === poi);
  // --- A: Walton Street wall: run, climb, balance along the coping, drop & roll, jog back
  const wall = map.barriers.find((b) => b.id === 'w999276231');
  if (wall && !(game.overrides && game.overrides.skip.has(wall.id))) {
    const pts = wall.pts;                                      // runs north from (-225.2,-17.6); the pavement is to the right (east)
    const face = wallPoint(pts, 3.2, 0.45), top0 = wallPoint(pts, 3.2, 0), top1 = wallPoint(pts, 22.5, 0), land = wallPoint(pts, 23.4, 1.9);
    const rollTo = [land[0] + 0.15, land[1] - 2.6];
    routes.push({ name: 'Walton Street wall', start: [-218.8, 1.0], segs: [
      ['say', 'start'], ['pause', 1.2, 'stand'],
      ['run', [-219.6, -8.6], 5.4], ['run', [-222.0, -16.5], 5.4], ['run', face, 4.2],
      ['climb', [top0[0], top0[1], WALL_TOP]],
      ['pause', 0.8, 'balance'],
      ['balance', [top1[0], top1[1], WALL_TOP], 1.25],
      ['pause', 0.6, 'balance'],
      ['drop', [land[0], land[1], 0], 1.5],
      ['roll', rollTo, 1.0, 'FAIL'],
      ['run', [rollTo[0] + 0.3, rollTo[1] - 2.5], 3.0, 'CHEER'],
      ['pause', 2.5, 'stand'], ['say', 'done'],
      ['walk', [-223.0, -30.0], 1.6], ['walk', [-221.8, -16.0], 1.6], ['walk', [-219.6, -8.6], 1.6], ['walk', [-218.8, 1.0], 1.6],
    ] });
  }
  // --- B: Provost's Lane bike stands: rail precisions stand to stand, drop & roll, jog back
  const sB = standsOf('n1807845503').sort((a, b) => b.x - a.x);       // east -> west
  if (sB.length >= 6) {
    const P = (i, y) => [sB[i].x, sB[i].z, y];
    routes.push({ name: "Provost's Lane stands", start: [-232.0, -48.4], segs: [
      ['say', 'start'], ['pause', 1.0, 'stand'],
      ['run', [sB[0].x + 2.2, sB[0].z], 4.6],
      ['precision', P(0, STAND_TOP), 1.3, 0.35],
      ['pause', 0.6, 'precision-hold'],
      ['precision', P(2, STAND_TOP), 1.3, 0.45, 'FAIL'],
      ['pause', 0.5, 'precision-hold'],
      ['precision', P(4, STAND_TOP), 1.3, 0.45],
      ['pause', 0.4, 'precision-hold'],
      ['precision', P(5, STAND_TOP), 1.1, 0.3],
      ['pause', 0.5, 'precision-hold'],
      ['drop', [sB[5].x - 1.9, sB[5].z - 0.1, 0], 1.0],
      ['roll', [sB[5].x - 4.4, sB[5].z - 0.3], 1.0],
      ['run', [sB[5].x - 6.5, sB[5].z - 0.4], 3.0, 'CHEER'],
      ['pause', 2.5, 'stand'], ['say', 'done'],
      ['walk', [sB[0].x + 3.0, sB[0].z + 0.9], 1.6], ['walk', [-232.0, -48.4], 1.6],
    ], resume: 9 });
  }
  // --- C: Gloucester Green bollard (OSM n6863361940, 0.85 m), in the NW corner of the square by The Heyes: run in from
  // the east, speed vault over it, turn, precision onto its top, drop & roll back out into the square
  const bol = map.gates.find((g) => g.id === 'n6863361940');
  if (bol && !(game.overrides && game.overrides.skip.has(bol.id))) {
    const [bx, bz] = bol.p;
    const at = (k) => [bx + k, bz];                      // k > 0: east of the bollard (open square); wall ~3.6 m west
    routes.push({ name: 'Gloucester Green bollard', start: at(9), segs: [
      ['say', 'start'], ['pause', 1.0, 'stand'],
      ['run', at(3.0), 4.6],
      ['vault', at(-2.6), 0.95, 0.55],
      ['pause', 0.9, 'stand'],
      ['walk', at(-2.2), 0.8],
      ['pause', 0.6, 'stand'],
      ['precision', [bx, bz, 0.85], 1.4, 0.4, 'FAIL'],
      ['pause', 1.4, 'precision-hold'],
      ['drop', [...at(1.8), 0], 1.0],
      ['roll', at(4.2), 1.0],
      ['run', at(6.2), 3.0, 'CHEER'],
      ['pause', 2.5, 'stand'], ['say', 'done'],
      ['walk', at(9), 1.5],
    ], resume: 11 });
  }
  return routes;
}

// Compile a route into a flat timeline. With fail=true the segment flagged 'FAIL' ends in a face-plant + brush-off,
// then he walks to the start of segment `resume` (default: the segment after the failed one) and carries on.
function compileRoute(R, fail, reach) {
  const out = [];
  let x = R.start[0], z = R.start[1], y = 0, h = 0, t = 0, failedYet = false;
  const push = (o) => { o.t0 = t; t += o.dur; out.push(o); };
  const segs = R.segs;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], k = s[0];
    if (k === 'say') { if (!(failedYet && s[1] === 'done')) push({ k: 'say', what: s[1], x0: x, z0: z, y0: y, x1: x, z1: z, y1: y, dur: 0, h }); continue; }
    if (k === 'pause') { push({ k: 'pause', pose: s[2], x0: x, z0: z, y0: y, x1: x, z1: z, y1: y, dur: s[1], h }); continue; }
    const to = s[1], x1 = to[0], z1 = to[1], y1 = to.length > 2 ? to[2] : y, dist = Math.hypot(x1 - x, z1 - z);
    if (dist > 0.05) h = angTo(x1 - x, z1 - z);
    const flag = s[s.length - 1];
    const o = { k, x0: x, z0: z, y0: y, x1, z1, y1, h, cheer: flag === 'CHEER' && !failedYet };
    if (k === 'run' || k === 'walk' || k === 'balance') { o.v = s[2]; o.dur = Math.max(0.05, dist / s[2]); }
    else if (k === 'precision') { o.dur = s[2]; o.hop = s[3]; }
    else if (k === 'vault') { o.dur = s[2]; o.hop = s[3]; }
    else if (k === 'drop') o.dur = s[2];
    else if (k === 'roll') o.dur = s[2];
    else if (k === 'climb') { o.dur = 2.4; o.hang = y1 - reach; }
    if (fail && flag === 'FAIL') {
      // the failed move: precision falls short (lands on the ground between), roll turns into a face-plant
      failedYet = true;
      if (k === 'precision') { o.x1 = lerp(x, x1, 0.25) + Math.cos(h) * 0.6; o.z1 = lerp(z, z1, 0.25) - Math.sin(h) * 0.6; o.y1 = 0; o.failed = true; }
      if (k !== 'roll') push(o);
      const fx = k === 'precision' ? o.x1 : x, fz = k === 'precision' ? o.z1 : z;
      push({ k: 'fall', x0: fx, z0: fz, y0: 0, x1: fx, z1: fz, y1: 0, dur: 4.3, h });
      push({ k: 'pause', pose: 'brushoff', x0: fx, z0: fz, y0: 0, x1: fx, z1: fz, y1: 0, dur: 2.8, h });
      push({ k: 'say', what: 'fail', x0: fx, z0: fz, y0: 0, x1: fx, z1: fz, y1: 0, dur: 0, h });
      // resume: walk to where the next ground-level segment starts
      let j = R.resume !== undefined ? R.resume : i + 1;
      while (j < segs.length && (segs[j][0] === 'say' || segs[j][0] === 'pause')) j++;
      let rx = fx, rz = fz;
      for (let q = j - 1; q > i; q--) { const sq = segs[q]; if (sq[0] !== 'say' && sq[0] !== 'pause') { rx = sq[1][0]; rz = sq[1][1]; break; } }
      if (k === 'roll') { rx = x1; rz = z1; }
      const d = Math.hypot(rx - fx, rz - fz);
      const hh = d > 0.05 ? angTo(rx - fx, rz - fz) : h;
      push({ k: 'walk', x0: fx, z0: fz, y0: 0, x1: rx, z1: rz, y1: 0, v: 1.4, dur: Math.max(0.05, d / 1.4), h: hh });
      x = rx; z = rz; y = 0; h = hh;
      i = j - 1;
      continue;
    }
    push(o);
    x = o.x1; z = o.z1; y = o.y1;
  }
  return { segs: out, T: t };
}

// Evaluate a compiled segment at local time ts into out {x,y,z,h,pose,act,speed}
function evalSeg(s, ts, out) {
  const u = s.dur > 0 ? clamp(ts / s.dur, 0, 1) : 1;
  out.h = s.h; out.act = -1; out.speed = 0; out.y = s.y0;
  switch (s.k) {
    case 'run': case 'walk': case 'balance':
      out.x = lerp(s.x0, s.x1, u); out.z = lerp(s.z0, s.z1, u); out.y = lerp(s.y0, s.y1, u);
      out.pose = s.k === 'balance' ? 'balance' : 'stand'; out.speed = s.v; break;
    case 'precision': {
      const m = sm(0.24, 0.62, u);
      out.x = lerp(s.x0, s.x1, m); out.z = lerp(s.z0, s.z1, m);
      out.y = lerp(s.y0, s.y1, m) + s.hop * Math.sin(Math.PI * m);
      out.pose = 'precision'; out.act = s.failed ? Math.min(u, 0.64) + (u > 0.64 ? 0 : 0) : u;
      if (s.failed && u > 0.6) { out.pose = 'fall-start'; }
      break;
    }
    case 'vault': {
      out.x = lerp(s.x0, s.x1, u); out.z = lerp(s.z0, s.z1, u);
      out.y = s.hop * Math.sin(Math.PI * clamp((u - 0.12) / 0.7, 0, 1));
      out.pose = 'vault'; out.act = u; out.speed = 4; break;
    }
    case 'drop': {
      const a = lerp(0.18, 1, u), m = clamp((a - 0.24) / 0.4, 0, 1);
      out.x = lerp(s.x0, s.x1, m); out.z = lerp(s.z0, s.z1, m);
      out.y = lerp(s.y0, s.y1, m * m) + 0.3 * 4 * m * (1 - m) * (s.y0 > 1 ? 1 : 0.6);
      out.pose = 'precision'; out.act = a; break;
    }
    case 'roll': out.x = lerp(s.x0, s.x1, u); out.z = lerp(s.z0, s.z1, u); out.y = 0; out.pose = 'roll'; out.act = u; out.speed = 2; break;
    case 'climb': {
      const hy = s.hang;
      let y = hy * sm(0, 0.22, u);
      if (u > 0.45) y = lerp(hy, s.y1 - 0.62, sm(0.45, 0.72, u));
      if (u > 0.72) y = lerp(s.y1 - 0.62, s.y1, sm(0.72, 0.9, u));
      const m = sm(0.6, 0.9, u);
      out.x = lerp(s.x0, s.x1, m); out.z = lerp(s.z0, s.z1, m); out.y = y;
      out.pose = 'climb'; out.act = u; break;
    }
    case 'fall': out.x = s.x0; out.z = s.z0; out.y = 0; out.pose = 'fall'; break;
    default: out.x = s.x0; out.z = s.z0; out.y = s.y0; out.pose = s.pose === 'precision-hold' ? 'precision' : s.pose || 'stand';
      if (s.pose === 'precision-hold') out.act = 0.84 + 0.1 * u;     // crouched on the rail, rising a little
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ module
export default {
  id: 'friends',
  install(game) {
    const scene = game.worldScene, ped = game.pedestrians;
    // ---- graph + Dijkstra
    const names = Object.keys(N), idx = new Map(names.map((n, i) => [n, i]));
    const adj = names.map(() => []);
    for (const [a, b] of E) { const i = idx.get(a), j = idx.get(b); const d = Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]); adj[i].push([j, d]); adj[j].push([i, d]); }
    function nodePath(a, b) {
      const n = names.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
      const s = idx.get(a), t = idx.get(b); dist[s] = 0;
      for (;;) {
        let u = -1, best = Infinity;
        for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
        if (u < 0 || u === t) break;
        done[u] = 1;
        for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
      }
      const out = [];
      for (let v = t; v >= 0; v = prev[v]) { out.push(N[names[v]]); if (v === s) break; }
      return out.reverse();
    }

    const routes = buildRoutes(game);
    const ids = Object.keys(ROUTINE).filter((id) => PEOPLE[id]);
    const npcs = [];
    const slotPos = (spot, k, n) => {      // k-th of n people at a spot: around the conversation ring
      const S = SPOTS[spot];
      if (S.hidden) return N[S.node];
      if (S.parkour !== undefined) { const R = routes[S.parkour]; return R ? R.start : N[S.node]; }
      if (S.stroll) return S.stroll[0];
      const a = (k / Math.max(1, n)) * TAU + 0.6;
      return [S.c[0] + Math.cos(a) * S.r[0], S.c[1] + Math.sin(a) * S.r[1]];
    };

    ids.forEach((id, pi) => {
      const P = PEOPLE[id], look = lookFor(id);
      const ch = createCharacter(look);
      ch.setLabel(P.label);
      ch.group.visible = false;
      scene.add(ch.group);
      const home = N[SPOTS.home.node];
      const n = {
        id, P, ch, pi, tl: null, tlDay: NaN, paths: new Map(), speed: WALK_SPEED[id] || 1.3,
        pos: new THREE.Vector3(), x: home[0], y: 0, z: home[1], h: 0, pose: 'stand', act: -1, animSpeed: 0,
        spot: 'home', entry: 0, walking: false, hidden: true, taken: false, shown: false, arrived: false, inKitchen: false,
        hideLatch: -1, offX: 0, offZ: 0, lastX: NaN, lastZ: NaN, hold: false, greetT: 0, near: false, talkN: (pi * 7) % 5,
        segIdx: -1, loopIdx: -1, chatT: 4 + pi * 1.3, gy: 0, gyE: NaN, gyT: 0, gyX: NaN, gyZ: NaN, downT: 0, downX: 0, downZ: 0, knockT: 0,
        inShop: false, ambT: 25 + pi * 4.5, duckT: 0, duckCool: 0, lastEntryT: NaN, homeDue: 0,
        // walk-in rooms: rm = the room (id) his leg has him in, yl / yg = that leg's height (room frame) and how much of it is
        // the world's ground, gait = the walk he is drawn with (-1: animSpeed), hs = the heading he is drawn at (world),
        // ipos = where he is in the PLAYER's frame (the [E] prompt), legs = his legs per room spot
        rm: null, yl: 0, yg: 1, gait: -1, hs: 0, ipos: new THREE.Vector3(), legs: new Map(), side: true, pd: Infinity,
        // tagging along (_friends_follow.js): fol = 'follow' | 'return' | null, rt = where the routine has him meanwhile
        fol: null, folEnd: false, rt: { x: home[0], z: home[1], hidden: true, seen: false }, rspot: 'home',
      };
      npcs.push(n);
      n.handle = game.interact.add({
        pos: () => n.ipos, radius: 2.4, label: () => `Talk to ${P.label}`,
        enabled: () => n.shown && n.side && !rtalkOn(n) && (!!n.rm || n.pos.y - (n.gyE || 0) < 0.5) && !n.ch.isDown && (n.segKind === undefined || n.segKind === 'pause' || n.segKind === 'walk' || n.segKind === 'run'),
        onUse: () => talk(n),
      });
    });
    const byId = new Map(npcs.map((n) => [n.id, n]));
    { const y = byId.get('yang'); if (y) y.yangSpeech = new YangSpeech(); }
    // Miguel's hal invitation: for a few seconds after he invites you (or asks you in a talk) with a trip coming up,
    // his [E] is "Go to hal with Miguel" instead of Talk
    { const m = byId.get('miguel'); if (m) { const base = m.handle.enabled; m.handle.enabled = () => base() && !halOffer();
      m.handle2 = game.interact.add({ pos: () => m.ipos, radius: 2.6, label: 'Go to hal with Miguel', enabled: () => base() && halOffer(), onUse: () => acceptHal(m) }); } }

    // walking path from spot `prev` to spot `spot` for person n (cached per person: ring slots depend on n.pi)
    function pathFor(n, prev, spot) {
      const key = prev + '>' + spot;
      let P = n.paths.get(key); if (P) return P;
      const from = slotPos(prev, n.pi, ids.length), to = slotPos(spot, n.pi, ids.length);
      P = mkPath([from, ...nodePath(SPOTS[prev].node, SPOTS[spot].node), to]);
      n.paths.set(key, P);
      return P;
    }
    function mkPath(pts) {
      // drop duplicate points and a first/last node that doubles back
      const clean = [];
      for (const p of pts) { const q = clean[clean.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.3) clean.push(p); }
      const xs = new Float32Array(clean.length), zs = new Float32Array(clean.length), cum = new Float32Array(clean.length);
      clean.forEach((p, i) => { xs[i] = p[0]; zs[i] = p[1]; cum[i] = i ? cum[i - 1] + Math.hypot(p[0] - clean[i - 1][0], p[1] - clean[i - 1][1]) : 0; });
      return { xs, zs, cum, len: cum[cum.length - 1] };
    }
    // leaving a stroll: from wherever the stroll has him at that moment, back along it to its start, then on as usual
    function leavePath(n, S, tr, spot) {
      const v = strollEval(S, tr), P = S.stroll, pts = [[v.x, v.z]];
      for (let k = v.seg - 1; k >= 0; k--) pts.push(P[k]);
      return mkPath([...pts, ...nodePath(S.node, SPOTS[spot].node), slotPos(spot, n.pi, ids.length)]);
    }
    // the person's absolute timeline (routine + chicken-dippers sessions) for days day-1..day+1, rebuilt once a game day
    function timelineFor(n, day) {
      if (n.tlDay === day) return n.tl;
      const tl = personTimeline(n.id, ROUTINE[n.id], day);
      for (let i = 0; i < tl.length; i++) {
        const prev = i ? tl[i - 1].spot : tl[i].spot, PS = SPOTS[prev];
        const tr = i && PS.stroll ? (tl[i].T - tl[i - 1].T) * HOUR_S - tl[i - 1].path.len / n.speed : -1;
        tl[i].path = tl[i].jump ? mkPath([slotPos(tl[i].spot, n.pi, ids.length)])     // (Prof. Yang at midnight: hidden to hidden, no walk)
          : tr > 0 && prev !== tl[i].spot ? leavePath(n, PS, tr, tl[i].spot) : pathFor(n, prev, tl[i].spot);
      }
      try { annotate(n, tl); } catch (e) { if (!legErr) { legErr = true; console.warn('[friends] walk-in legs', e); } for (const q of tl) { q.inLeg = q.outLeg = q.kLeg = q.pre = null; q.nextE = q.prevE = null; q.tArr = NaN; } }
      n.tl = tl; n.tlDay = day;
      return tl;
    }

    // ---------------------------------------------------------------------------------------------- walk-in legs
    // A friend bound for a walk-in room (core/interiors.js "seamless") walks in through its real door. OUTDOOR timings are
    // exactly what they were (the path to the door node, from the entry's time): the walk inside is taken out of the time
    // he used to stand hidden at the door.
    //   e.inLeg   door node -> through the door -> to his spot inside; starts when the outdoor path ends
    //   e.outLeg  the way back; ENDS at the next entry's time (so the next outdoor walk starts on time from the node)
    //   e.kLeg    (Earl kitchen) ends at the moment the dippers scene has him at the kitchen door (e.kEnd)
    //   e.pre     (after a scene that has him until its end: the kitchen, hal) starts when the scene lets him go
    //             (e.preT0 s from the entry's time), and the outdoor walk follows it
    // All of it is a function of the shared clock and of static data (the Earl plan; a room's registered doorway), so
    // clients agree. A room's own spot (Prof. Yang's seat) is known once the room is built: only the indoor end of his
    // leg depends on that, and only players near enough to have built the room can see it.
    let legErr = false, roomSig = -1;
    const _l2 = [0, 0], _l3 = [0, 0], lv = { x: 0, z: 0, y: 0, yg: 1, room: null, h: 0, speed: 0, intent: false };
    const defOf = (id) => { const I = game.interiors, d = I && I.get ? I.get(id) : null; return d && d.sl && d.sl.toWorld && d.sl.portals && d.sl.portals[0] ? d : null; };
    /** the legs in and out of the walk-in room of a hidden door spot (not the Earl Building: earlLeg), or null */
    function roomLegs(n, spot, tOut) {
      const id = roomOfSpot(spot), def = id && id !== EARL_ID ? defOf(id) : null; if (!def) return null;
      const key = spot + (def.built ? '|b' : '|');
      if (n.legs.has(key)) return n.legs.get(key);
      const S = def.sl, P = S.portals[0], node = N[SPOTS[spot].node], ox = Math.sin(P.out), oz = Math.cos(P.out), dep = P.depth ?? 0.3, py = P.y || 0;
      const w = (k, y, wait, intent) => { const q = S.toWorld(P.at[0] + ox * k, P.at[1] + oz * k, [0, 0]); return [q[0], q[1], y, y === null ? null : id, wait || 0, 1, intent ? 1 : 0]; };
      const O = w(dep + 1.6, null), F = w(dep + 0.05, null), A = w(-0.05, py), In = w(-1.5, py);
      let G = null;
      if (Math.hypot(O[0] - node[0], O[1] - node[1]) <= 15) {
        // the room's own spot for him (room coordinates), reached in a straight line if the room's collider says it is
        // clear, else round one corner, else straight (GUESS: no route through the furniture is known here)
        const mid = [];
        let sp = null, viaWay = false;
        try { sp = spot === 'halIn' ? { x: HAL_DOOR_IN[0], z: HAL_DOOR_IN[1], y: py } : SPOTS[spot].room && def.built ? yangSpot(game, id) : null; } catch { sp = null; }
        if (sp) {
          const ix = P.at[0] - ox * 1.5, iz = P.at[1] - oz * 1.5, col = def.collider, clear = (a, b, c, d) => !col || !col.raycast || col.raycast(a, b, c, d) === null;
          const sy = Number.isFinite(sp.y) ? sp.y : py, toW = (x, z, y) => { const q = S.toWorld(x, z, [0, 0]); return [q[0], q[1], y, id, 0, 1, 0]; };
          // a room with a way of its own to his spot (the Library: up the round stair, _worcint_library_plan.js
          // WALK_UP) is walked along it from the doorway; the corner rule then runs from the way's last point
          let fx = ix, fz = iz, fy = py;
          if (sp.via && sp.via.length) { for (const q of sp.via) mid.push(toW(q[0], q[1], q[2])); const l = sp.via[sp.via.length - 1]; fx = l[0]; fz = l[1]; fy = l[2]; viaWay = true; }
          if (Math.hypot(sp.x - fx, sp.z - fz) > 0.3) {
            if (!clear(fx, fz, sp.x, sp.z)) { if (clear(fx, fz, sp.x, fz) && clear(sp.x, fz, sp.x, sp.z)) mid.push(toW(sp.x, fz, fy)); else if (clear(fx, fz, fx, sp.z) && clear(fx, sp.z, sp.x, sp.z)) mid.push(toW(fx, sp.z, fy)); }
            mid.push(toW(sp.x, sp.z, sy));
          }
        }
        const nd = [node[0], node[1], null, null, 0, 1, 0], wait = (p, intent) => { const q = p.slice(); q[4] = 0.5; q[6] = intent; return q; };
        let sIn = n.speed;
        const inner = viaWay ? [] : [In];      // (a room's own way starts at its doorway)
        const build = (v) => mkLeg([nd, wait(O, 1), F, A, ...inner, ...mid], v);
        let inn = build(sIn);
        // hal: his indoor scene has him at the door mark HAL_DOOR_S after he goes in: pace the leg to be there then
        if (spot === 'halIn') { const walk = inn.dur - 0.5, avail = HAL_DOOR_S - (tOut || 0) - 0.5, f = avail > 0 ? walk / avail : 9; if (f > 0.6 && f < 1.7) inn = build(sIn * f); }
        const out = mkLeg(viaWay ? [...mid.slice(1).reverse(), wait(mid[0], 1), A, F, O, nd] : [...mid.slice().reverse(), wait(In, 1), A, F, O, nd], n.speed);
        G = { inn, out };
      }
      n.legs.set(key, G);
      return G;
    }
    function annotate(n, tl) {
      const earl = defOf(EARL_ID), node = N.EARL_D, v = n.speed;
      for (let i = 0; i < tl.length; i++) {
        const e = tl[i], next = tl[i + 1] || null;
        e.inLeg = e.outLeg = e.kLeg = e.pre = null; e.preT0 = 0; e.kEnd = 0; e.inside = false; e.tArr = e.tDep = NaN;
        e.prevE = i ? tl[i - 1] : null; e.nextE = next; e.tOut = e.path.len / v; e.stay = next ? (next.T - e.T) * HOUR_S : Infinity;
        if (earl && e.spot === 'earlIn' && e.session) { const w = kitchenWindow(n.id); e.tArr = e.session.start + w[0] / HOUR_S; e.tDep = e.session.start + w[1] / HOUR_S; }
      }
      for (let i = 0; i < tl.length; i++) {
        const e = tl[i], prev = e.prevE, next = e.nextE, S = SPOTS[e.spot], rid = roomOfSpot(e.spot);
        if (earl && e.spot === 'earl') {
          const chain = !!prev && prev.spot === 'earl', afterK = !!prev && prev.spot === 'earlIn' && prev.tDep === prev.tDep, go = !!next && next.spot === 'earlIn' && next.tArr === next.tArr;
          const stays = !!next && (next.spot === 'earl' || next.spot === 'earlIn');
          let used = 0;
          if (afterK) { e.pre = earlLeg('K:R', node, v); e.preT0 = (prev.tDep - e.T) * HOUR_S; e.inside = true; used = e.preT0 + e.pre.dur; }
          else if (chain) e.inside = prev.inside;
          else if (!go) { const L = earlLeg('in:R', node, v), Lo = stays || !next ? 0 : earlLeg('R:out', node, v).dur; if (e.tOut + L.dur + Lo <= e.stay) { e.inLeg = L; e.inside = true; used = e.tOut + L.dur; } }
          // (to the kitchen door for the moment the scene has him there; a few seconds short of time for the whole walk: brisker)
          if (go) { e.kLeg = earlLegIn(e.inside ? 'R:K' : 'in:K', node, v, (next.tArr - e.T) * HOUR_S); e.kEnd = next.tArr; }
          else if (e.inside && next && !stays) { const Lo = earlLeg('R:out', node, v); if (used + Lo.dur <= e.stay) e.outLeg = Lo; }
        } else if (earl && prev && prev.spot === 'earlIn' && prev.tDep === prev.tDep && e.spot !== 'earlIn') { e.pre = earlLeg('K:out', node, v); e.preT0 = (prev.tDep - e.T) * HOUR_S; }
        else if (rid && rid !== EARL_ID && S.hidden && S.door) {
          const G = roomLegs(n, e.spot, e.tOut);
          if (G) {
            const chain = !!prev && roomOfSpot(prev.spot) === rid && prev.inside, stays = !!next && roomOfSpot(next.spot) === rid;
            const Li = chain ? null : G.inn, Lo = stays || !next || e.spot === 'halIn' ? null : G.out;
            if (e.tOut + (Li ? Li.dur : 0) + (Lo ? Lo.dur : 0) <= e.stay) { e.inLeg = Li; e.outLeg = Lo; e.inside = true; }
          }
        }
        // out of hal: the indoor scene has him at the door mark until 0.3 s before the trip ends
        if (prev && prev.spot === 'halIn' && prev.inside && e.spot !== 'halIn' && !e.pre) { const G = roomLegs(n, 'halIn', 0); if (G) { e.pre = G.out; e.preT0 = -0.3; } }
      }
    }
    /** on a leg, tr seconds in */
    function onLeg(n, L, tr) {
      legAt(L, tr, lv);
      n.x = lv.x; n.z = lv.z; n.y = 0; n.h = lv.h; n.rm = lv.room; n.yl = lv.y; n.yg = lv.yg;
      n.pose = 'stand'; n.gait = lv.speed; n.animSpeed = lv.intent ? DOOR_INTENT_V : lv.speed;
      n.walking = true; n.hidden = false; n.arrived = false;
    }
    /** a character group at a WORLD position: in the world's scene, or in the scene (and frame) of the walk-in room he is in */
    function put(n, g, x, y, z, h) {
      const I = game.interiors;
      if (I && I.place) { let d = null; try { d = I.place(g, x, y, z, h) || null; } catch { d = null; } if (d || !n.rm) return; }
      // (no core helper, or core has this point outdoors — the thickness of the wall at the doorway — where the leg has
      //  him in the room: the room is drawn over the world there, so he must be in the room's scene)
      const def = n.rm ? defOf(n.rm) : null;
      if (def && def.scene) { const S = def.sl; S.toLocal(x, z, _l2); if (g.parent !== def.scene) def.scene.add(g); g.position.set(_l2[0], y - S.base(), _l2[1]); g.rotation.y = h - S.rot; }
      else { if (g.parent !== scene) scene.add(g); g.position.set(x, y, z); g.rotation.y = h; }
    }
    /** the player's true world position (player.pos is in the room's frame while inside a walk-in room) */
    const pworld = () => { const c = game.interiors && game.interiors.current, p = game.player; return c && c.sl && p.place === c.id && p.worldPos ? p.worldPos : p.pos; };

    // reach for the climb: hands above the feet origin with the arms overhead
    const kot = byId.get('kotaro');
    const reach = kot ? (() => { const D = kot.ch.dims; return D.hipY + D.waist + D.shY + D.UA + D.FA + 0.06; })() : 2.0;
    const compiled = routes.map((R) => {
      const a = compileRoute(R, false, reach), b = compileRoute(R, true, reach);
      const T = Math.max(a.T, b.T) + 3;           // pad so every loop has the same length (shared timing)
      return { R, ok: a, fail: b, T };
    });

    // ---- helpers
    const tmp = { x: 0, y: 0, z: 0, h: 0, pose: 'stand', act: -1, speed: 0 };
    const near = [];
    let dbg = null, dbgHour = null, takenT = 0;
    const fmt = (s) => s.replace(/\{name\}/g, game.player.name || 'you');
    const pick = (a, seed) => a[Math.floor(hash01(seed) * a.length) % a.length];
    const dayIdx = () => Math.floor(game.time.now() / DAY_MS);
    let voicePref = true; try { voicePref = localStorage.getItem('gto.friendVoices') !== '0'; } catch (e) { /* */ }
    const voices = new FriendVoices(PEOPLE, { enabled: voicePref, game });

    // speech bubble (+ spoken, for friends and Prof. Yang's catchphrases (PEOPLE.voiced), with volume by distance)
    function bubble(n, text, secs, priority = false) {
      const spoken = n.P.kind === 'friend' || n.P.voiced;
      n.ch.say(text, spoken ? Math.max(secs, (voices.duration(n.id, text) || 0) + 0.6) : secs);
      if (spoken) { const p = pworld(); voices.say(n.id, text, Math.hypot(p.x - n.pos.x, p.z - n.pos.z), priority, { pos: n.ipos, ch: n.ch }); }      // (from where he stands, in the player's frame)
    }
    // multiplayer: lines that depend on something each client simulates for itself (Lorenzo's ducks) are decided by one
    // client - the lowest-id player within r of the friend (solo: us) - and sent to the others as a 'friendLine' event
    const decider = (x, z, r) => {
      const net = game.net, me = net && net.connected ? net.id : 0;
      if (!me) return true;
      for (const o of net.others.values()) if (o.id < me && o.seen !== false && o.place === 'world' && Math.hypot(o.tx - x, o.tz - z) < r) return false;
      return true;
    };
    if (game.net && game.net.on) game.net.on('friendLine', (d) => {
      const n = d && byId.get(d.n);
      if (!n || d.k !== 'duck' || n.id !== 'lorenzo') return;
      n.duckCool = Math.max(n.duckCool || 0, +d.c || 0);
      if (n.shown && !n.ch.isDown) bubble(n, CATCH.lorenzo.duck[0], 4, true);
    });
    // ---- every player (local and remote) in WORLD coordinates, once a frame: "is anyone near", "who is nearest", "where is
    // the player who is playing Aiken" are asked of all of them, so every client answers alike
    const PL = [];
    const myId = () => (game.net && game.net.connected ? game.net.id : 0);
    function scanPlayers() {
      PL.length = 0;
      const p = game.player, I = game.interiors, cur = I && I.current;
      if (p.place === 'world' || (cur && cur.sl && p.place === cur.id && p.worldPos)) { const w = pworld(); PL.push({ id: myId(), name: p.name, person: personOf(p.look, p.name), x: w.x, z: w.z }); }
      if (game.net && game.net.others) for (const o of game.net.others.values()) {
        if (!o.seen) continue;
        let x = o.x, z = o.z;
        if (o.place !== 'world') { const dd = I && I.get ? I.get(o.place) : null; if (!(dd && dd.sl && dd.sl.toWorld)) continue; const w = dd.sl.toWorld(o.x, o.z, _l2); x = w[0]; z = w[1]; }
        PL.push({ id: o.id, name: o.name, person: personOf(o.look, o.name), x, z });
      }
    }
    const anyNear = (x, z, r) => { for (const q of PL) if (Math.hypot(q.x - x, q.z - z) < r) return true; return false; };
    const playerById = (id) => { for (const q of PL) if (q.id === id) return q; return null; };
    /** where friend id is: the NPC, or the avatar of the player who is playing them -> { x, z } | null */
    function whereOf(id) {
      for (const q of PL) if (q.person === id) return q;
      const a = byId.get(id); return a && !a.hidden && !a.taken ? { x: a.x + a.offX, z: a.z + a.offZ } : null;
    }
    /** whom a line with {name} is said to, the same on every client: the nearest of the friends standing by and the players
     *  (a player who is playing a friend is that friend) within r; null = nobody */
    function addressee(n, r) {
      let best = null, bd = r;
      const x = n.x + n.offX, z = n.z + n.offZ;
      for (const m of npcs) if (m !== n && !m.hidden && !m.taken && !m.walking && m.P.kind === 'friend') { const d = Math.hypot(m.x + m.offX - x, m.z + m.offZ - z); if (d < Math.min(bd, 5)) { bd = d; best = m.P.name; } }
      for (const q of PL) { if (q.person === n.id) continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q.person ? PEOPLE[q.person].name : q.name || 'you'; } }
      return best;
    }
    /** is the moment "now" within the first seconds of shared slot k (period P ms, phase off)? A client that only then
     *  has the friend in view does not say a slot's line late. */
    const fresh = (now, k, P, off) => now - (k - off) * P < 2500;
    // ---- the [E] Talk conversation someone ELSE is having with a friend ('friendTalk'): n.rtalk = { p, t0, until }
    const rtalkOn = (n) => !!n.rtalk && performance.now() < n.rtalk.until && !!(game.net && game.net.others && game.net.others.has(n.rtalk.p));
    /** in a conversation (ours or another player's): no slot line then — on every client alike */
    const busy = (n) => n.hold || rtalkOn(n);
    const sendLine = (kind, d) => { const net = game.net; if (net && net.connected) net.send(kind, d); };
    /** a line one player set off: said here, and on every other client */
    function sayAll(n, text, secs, extra) { bubble(n, text, secs, true); sendLine('friendLine', { n: n.id, k: 'say', t: text, s: secs, ...extra }); }
    /** the figure that is this person on screen now says it: outdoors, or drawn inside a Worcester room (Prof. Yang, Miguel in hal) */
    function speak(n, text, secs) {
      if (n.id === 'yang' && yangRooms && yangRooms.shownIn && yangRooms.ch) { yangRooms.say(text, 0); return; }
      if (n.id === 'miguel' && n.hidden && hal && hal.m && hal.m.group && hal.m.group.visible) { hal.m.say(text, secs); return; }
      if (n.shown) bubble(n, text, secs, true);
    }
    const okText = (t) => typeof t === 'string' && t.length > 0 && t.length <= 240;
    if (game.net && game.net.on) game.net.on('friendLine', (d, o) => {
      if (!d || !o) return;
      // the scenes' own figures: a line a player set off in the Earl kitchen; the Hall cook answering a player
      if (d.n === 'dippers') { if (d.k === 'scene' && okText(d.t) && typeof d.r === 'string') { try { dippers.say(d.r, d.t, clamp(+d.s || 3, 1, 8), true); } catch (e) { /* */ } } return; }
      if (d.n === 'hall_cook') {
        if (d.k === 'pages' && Array.isArray(d.p)) d.p.slice(0, 4).forEach((t, k) => { if (okText(t)) setTimeout(() => { const c = hal && hal.cook; if (c && c.group && c.group.visible && game.player.place === 'worcint_hall') c.say(t, 3); }, k * 2800); });
        return;
      }
      const n = byId.get(d.n); if (!n) return;
      if (d.k === 'say' && okText(d.t)) { if (d.g) n.greetT = Math.max(n.greetT, 12); if (!n.ch.isDown) speak(n, d.t, clamp(+d.s || 3, 1, 8)); }
      else if (d.k === 'knock' && Number.isFinite(d.x + d.z + d.h) && Math.hypot(d.x - n.x - n.offX, d.z - n.z - n.offZ) < 6 && !n.ch.isDown) {
        n.knockT = game.time.now(); n.downT = 4.3; n.downX = d.x; n.downZ = d.z; n.hold = false; n.hs = d.h; n.h = d.h;
        if (n.shown) { n.ch.setPose('stand'); n.ch.setPose('fall'); if (okText(d.t)) bubble(n, d.t, 2.5, true); }
      }
    });
    if (game.net && game.net.on) game.net.on('friendTalk', (d, o) => {
      const n = d && byId.get(d.n); if (!n || !o || !Number.isFinite(d.t0)) return;
      if (d.end) { if (n.rtalk && n.rtalk.p === o.id) n.rtalk = null; return; }
      // two players on one friend: the earlier press keeps the conversation, then the lower id; the other's box closes
      if (n.hold && n.talkT0) {
        if (d.t0 < n.talkT0 || (d.t0 === n.talkT0 && o.id < myId())) yieldTalk(n); else return;
      }
      if (n.rtalk && n.rtalk.p !== o.id && rtalkOn(n) && !(d.t0 < n.rtalk.t0 || (d.t0 === n.rtalk.t0 && o.id < n.rtalk.p))) return;
      const secs = okText(d.s) ? Math.max(3, (voices.duration(n.id, d.s) || 0) + 0.6) : 0;
      n.rtalk = { p: o.id, t0: d.t0, until: performance.now() + (secs + 9) * 1000 };
      if (okText(d.s)) speak(n, d.s, secs);
    });
    /** our conversation with n gives way to another player's (theirs began first): close our box without a word more */
    function yieldTalk(n) {
      const ui = game.ui, dlg = n.talkDlg;
      n.talkYield = true;
      if (dlg && ui._dialog === dlg && ui.advanceDialog) for (let k = 0; k < 12 && ui._dialog === dlg; k++) ui.advanceDialog();
      n.hold = false; n.talkT0 = 0; n.talkDlg = null;
      try { voices.stop(); } catch (e) { /* */ }
    }
    // Prof. Yang eating in Hall now? (worcester_interiors.js meal timetable, honouring its test override)
    const yangMeal = (n) => {
      if (n.inRoom !== YANG_ROOMS.yHall || !n.arrived) return false;
      const W = game.worcint, f = W && W.force && W.force.meal !== null && W.force.meal !== undefined ? W.force.meal : undefined;
      return !!(f !== undefined ? f : hallMeal(dayIdx(), dbgHour !== null ? dbgHour : game.time.hour));
    };

    function talk(n) {
      if (rtalkOn(n) || n.hold) return;            // (another player is talking to them: wait your turn)
      n.hold = true;
      const lines = LINES[n.id] || ['Hello!'];
      const greet = greetsFor(n);
      const a = lines[n.talkN % lines.length], b = lines[(n.talkN + 1) % lines.length];
      n.talkN += 2;
      const seq = [fmt(pick(greet, n.talkN + n.pi)), fmt(a)];
      // Prof. Yang answers with one of the user's catchphrases ("Tasty food." while he is eating in Hall)
      if (n.id === 'yang') seq.push(yangMeal(n) ? yangLine('walkupMeal', 0) : yangLine('talk', n.talkN / 2 - 1));
      // Miguel around meal times (or with a hal trip coming up) asks you to come to hal instead
      else if (n.id === 'miguel' && (halSoon() || halMealWindow(curHour()))) {
        seq.push(fmt(HAL_INVITE[(n.talkN >> 1) % HAL_INVITE.length]));
        if (halSoon()) n.halAsk = performance.now() + 9000;
      }
      else if (b !== a) seq.push(fmt(b));
      // the conversation is OURS: every page goes to the other players as we turn to it (they hear the friend say it, see
      // them turned to us and held there), and the end when the box closes
      const t0 = game.time.now(); n.talkT0 = t0; n.talkYield = false; n.rtalk = null;
      game.ui.dialog(n.P.label, seq).then(() => {
        const gave = n.talkYield; n.talkYield = false;
        if (gave) return;
        n.hold = false; n.talkT0 = 0; n.talkDlg = null; sendLine('friendTalk', { n: n.id, t0, end: 1 });
        try { crew.onTalk(n); } catch (e) { /* */ } if (n.halAsk) { halOfferUntil = performance.now() + 9000; n.halAsk = 0; } });
      { const ui = game.ui, dlg = ui._dialog; n.talkDlg = dlg || null; let last = -1, sent = 0;
        const page = () => {
          if (!dlg || ui._dialog !== dlg || n.talkYield) return;
          const w = performance.now();
          if (dlg.i !== last) { last = dlg.i; sent = w; const l = dlg.lines[dlg.i], t = typeof l === 'object' && l ? l.text : l; sendLine('friendTalk', { n: n.id, t0, i: dlg.i, s: t }); }
          else if (w - sent > 4000) { sent = w; sendLine('friendTalk', { n: n.id, t0, i: dlg.i }); }      // (still on this page: they stay held)
          setTimeout(page, 100);
        };
        if (dlg) page(); else sendLine('friendTalk', { n: n.id, t0, i: 0, s: seq[0] }); }
      voices.dialog(n.id, seq, { pos: n.yangSpeech && yangRooms && yangRooms.shownIn && yangRooms.pos ? yangRooms.pos : n.ipos, ch: n.ch });   // speaks each page as it is shown (friends only)
    }

    function updateTaken() {
      const t = new Set();
      // (by look or by name, for us as for the others: every client hides the same people)
      const me = personOf(game.player.look, game.player.name); if (me) t.add(me);
      if (game.net && game.net.others) for (const o of game.net.others.values()) { const p = personOf(o.look, o.name); if (p) t.add(p); }
      for (const n of npcs) n.taken = t.has(n.id);
    }

    // where the timeline puts n at absolute hour T (= day*24 + hour) -> writes n.x/z/y/h/pose/act/animSpeed/hidden/walking/spot
    function schedule(n, T, day) {
      const tl = timelineFor(n, day), ei = entryAt(tl, T), e = tl[ei], Pth = e.path;
      const el = (T - e.T) * HOUR_S;                              // real seconds since this entry began
      const S = SPOTS[e.spot];
      n.spot = e.spot; n.entry = ei; n.act = -1; n.segKind = undefined; n.inKitchen = false; n.inShop = false; n.inRoom = null;
      const fromHidden = ei > 0 && SPOTS[tl[ei - 1].spot].hidden;
      // walk-in legs (see annotate): out of a scene's room first, then the outdoor path; into the Earl kitchen by the
      // scene's clock; out of the room he is in before the next entry begins
      let el0 = 0;
      if (e.pre) { const tr = el - e.preT0; if (tr < e.pre.dur) { onLeg(n, e.pre, tr); return; } el0 = e.preT0 + e.pre.dur; }
      if (e.kLeg) { const tr = e.kLeg.dur - (e.kEnd - T) * HOUR_S; if (tr >= 0) { onLeg(n, e.kLeg, tr); return; } }
      if (e.tArr === e.tArr && T < e.tArr && e.prevE && e.prevE.kLeg) { const L = e.prevE.kLeg; onLeg(n, L, L.dur - (e.tArr - T) * HOUR_S); return; }
      if (e.nextE && e.nextE.pre) { const tr = el - (e.stay + e.nextE.preT0); if (tr >= 0) { onLeg(n, e.nextE.pre, tr); return; } }
      const d = (el - el0) * n.speed;
      if (d < Pth.len) {
        // walking along the path
        let i = 1; while (i < Pth.cum.length - 1 && Pth.cum[i] < d) i++;
        const l0 = Pth.cum[i - 1], seg = Pth.cum[i] - l0, t = seg > 0 ? (d - l0) / seg : 1;
        n.x = lerp(Pth.xs[i - 1], Pth.xs[i], t); n.z = lerp(Pth.zs[i - 1], Pth.zs[i], t); n.y = 0;
        n.h = angTo(Pth.xs[i] - Pth.xs[i - 1], Pth.zs[i] - Pth.zs[i - 1]);
        n.pose = 'stand'; n.animSpeed = n.speed; n.walking = true; n.hidden = false; n.arrived = false;
        if (fromHidden && d < 0.01) n.hidden = true;
        return;
      }
      n.walking = false; n.arrived = true; n.animSpeed = 0;
      n.x = Pth.xs[Pth.xs.length - 1]; n.z = Pth.zs[Pth.zs.length - 1]; n.y = 0;
      if (S.hidden) {
        // a walk-in room: in through its door when he reaches it, out again in time for the next entry
        if (e.outLeg) { const tr = e.outLeg.dur - (e.stay - el); if (tr >= 0) { onLeg(n, e.outLeg, tr); return; } }
        if (e.inLeg) { const tr = el - el0 - e.tOut; if (tr < e.inLeg.dur) { onLeg(n, e.inLeg, tr); return; } }
        // gone (home / town / the bar / the Earl kitchen). Friends vanish once the player isn't watching (or at a door).
        if (n.hideLatch !== e.T) {
          const pl = game.player.pos, far = Math.hypot(pl.x - n.x, pl.z - n.z) > 22 || game.player.place !== 'world';
          if (S.door || far || e.jump || el > Pth.len / n.speed + 90) n.hideLatch = e.T;
        }
        n.hidden = n.hideLatch === e.T; n.pose = 'phone';
        if (S.kitchen) { n.inKitchen = true; n.hidden = true; }
        if (S.room) { n.inRoom = S.room; n.hidden = true; }      // Prof. Yang in a Worcester room (_friends_yang.js draws him there)
        if (e.inShop) { n.inShop = true; n.hidden = true; }
        return;
      }
      n.hideLatch = -1; n.hidden = false;
      if (S.stroll) { strollAt(n, S, el - Pth.len / n.speed); return; }
      if (S.parkour !== undefined && compiled[S.parkour]) {
        const C = compiled[S.parkour], tr = el - Pth.len / n.speed;
        const loop = Math.floor(tr / C.T), lt = tr - loop * C.T;
        const failed = hash01(day * 131 + e.h * 17 + loop * 7.3 + S.parkour) < 0.3;
        runRoute(n, C, failed ? C.fail : C.ok, lt, loop);
        return;
      }
      n.pose = S.pose || 'stand';
      // face the others at the same spot, or the spot's view when alone
      let cx = 0, cz = 0, k = 0;
      for (const m of npcs) if (m !== n && m.spot === n.spot && m.arrived && !m.hidden && !m.taken) { cx += m.x; cz += m.z; k++; }
      n.h = k ? angTo(cx / k - n.x, cz / k - n.z) : S.face ?? n.h;
      if (k === 0 && n.pose === 'talk') n.pose = 'stand';
    }

    // up and down a polyline at a dawdle, pausing at each end facing S.face (a function of the shared clock)
    const STROLL_V = 0.7, STROLL_P = 6;
    for (const S of Object.values(SPOTS)) if (S.stroll) { let L = 0; S.cum = S.stroll.map((p, i) => (L += i ? Math.hypot(p[0] - S.stroll[i - 1][0], p[1] - S.stroll[i - 1][1]) : 0)); S.len = L; }
    const sv = { x: 0, z: 0, h: 0, moving: false, seg: 1 };
    function strollEval(S, tr) {
      const leg = S.len / STROLL_V, C = 2 * (leg + STROLL_P), u = ((tr % C) + C) % C;
      let d, dir = 1;
      if (u < STROLL_P) d = 0; else if (u < STROLL_P + leg) d = (u - STROLL_P) * STROLL_V;
      else if (u < 2 * STROLL_P + leg) d = S.len; else { d = S.len - (u - 2 * STROLL_P - leg) * STROLL_V; dir = -1; }
      const P = S.stroll, cum = S.cum;
      let i = 1; while (i < P.length - 1 && cum[i] < d) i++;
      const l0 = cum[i - 1], seg = cum[i] - l0, t = seg > 0 ? clamp((d - l0) / seg, 0, 1) : 1;
      sv.moving = d > 0 && d < S.len; sv.seg = i;
      sv.x = lerp(P[i - 1][0], P[i][0], t); sv.z = lerp(P[i - 1][1], P[i][1], t);
      sv.h = sv.moving ? angTo((P[i][0] - P[i - 1][0]) * dir, (P[i][1] - P[i - 1][1]) * dir) : d > 0 && S.faceEnd !== undefined ? S.faceEnd : S.face;
      return sv;
    }
    function strollAt(n, S, tr) {
      const v = strollEval(S, tr);
      n.x = v.x; n.z = v.z; n.y = 0; n.h = v.h;
      n.pose = 'stand'; n.animSpeed = v.moving ? STROLL_V : 0;
    }

    function runRoute(n, C, tl, lt, loop) {
      const segs = tl.segs;
      let si = segs.length - 1;
      for (let i = 0; i < segs.length; i++) { if (segs[i].t0 + segs[i].dur > lt || i === segs.length - 1) { si = i; break; } }
      const s = segs[si];
      evalSeg(s, lt - s.t0, tmp);
      n.x = tmp.x; n.y = tmp.y; n.z = tmp.z; n.h = tmp.h; n.pose = tmp.pose; n.act = tmp.act; n.animSpeed = tmp.speed; n.segKind = s.k;
      if (lt > tl.T) { n.pose = 'stand'; n.act = -1; n.animSpeed = 0; n.segKind = 'pause'; }
      // one-shot events (cosmetic, per client) when a new segment starts
      const key = loop * 1000 + si;
      if (key !== n.segIdx) {
        const prevKey = n.segIdx; n.segIdx = key;
        if (prevKey >= 0 && n.shown) {
          if (s.k === 'say') bubble(n, pick(KOTARO_SAY[s.what], loop + si), 2.5);
          if (s.cheer) cheer(n);
        }
      }
    }

    function cheer(n) {
      const pl = game.player.pos;
      if (Math.hypot(pl.x - n.x, pl.z - n.z) > 45) return;
      if (ped && ped.near) {
        ped.near(n.x, n.z, 14, near);
        for (const p of near) if (p.character && !p.down) { p.character.setPose('clap', { duration: 2.6 }); }
      }
      for (const m of npcs) if (m !== n && m.shown && !m.walking && Math.hypot(m.x - n.x, m.z - n.z) < 14) m.ch.setPose('clap', { duration: 2.6 });
    }

    function place(n, T, day) {
      n.rm = null; n.gait = -1;
      if (dbg) {
        if (dbg.mode === 'lineup') {
          const i = dbg.order.indexOf(n.id);
          n.hidden = i < 0; n.x = dbg.x + (i - (dbg.order.length - 1) / 2) * dbg.gap * Math.cos(dbg.h); n.z = dbg.z - (i - (dbg.order.length - 1) / 2) * dbg.gap * Math.sin(dbg.h);
          n.y = 0; n.h = dbg.h; n.pose = dbg.pose || 'stand'; n.act = -1; n.animSpeed = 0; n.taken = false; n.walking = false;
          n.segKind = undefined; n.inKitchen = false; n.spot = 'lineup';   // no stale parkour / kitchen state
          return;
        }
        if (dbg.mode === 'parkour' && n.id === 'kotaro') {
          const C = compiled[dbg.route]; if (!C) return;
          runRoute(n, C, dbg.fail ? C.fail : C.ok, dbg.t, 0); n.hidden = false; n.taken = false; n.walking = false;
          return;
        }
      }
      // a debug Tesco visit (debugTesco) puts Lorenzo in the shop
      if (shopOvr && n.id === 'lorenzo') {
        schedule(n, T, day);
        n.spot = 'shop'; n.inShop = true; n.hidden = true; n.arrived = true; n.walking = false; n.animSpeed = 0;
        return;
      }
      // a local / debug kitchen session (player-Miguel cooking, or debugDippers) pulls its people into the kitchen
      if (ovr && ovr.ids.includes(n.id) && (n.id !== ovr.guest || cur.t >= GUEST_IN_S)) {
        schedule(n, T, day);
        n.spot = 'earlIn'; n.inKitchen = true; n.hidden = true; n.arrived = true; n.walking = false; n.animSpeed = 0;
        return;
      }
      schedule(n, T, day);
    }

    // ---- chicken dippers: the current kitchen session (scheduled on the shared clock, or a local/debug override)
    let ovr = null;                     // { ids, key, s, local?, debug?, fixed?, startMs, lorenzoSeated? }
    const cur = { t: 0, s: null, key: '', local: false, debug: false, lorenzoSeated: false };
    let sessDay = NaN, sessList = [];
    function currentDip(T, day) {
      if (ovr) {
        const t = ovr.fixed !== undefined ? ovr.fixed : (game.time.now() - ovr.startMs) / 1000;
        if (ovr.local && t >= DUR_S) ovr = null;
        else { cur.t = t; cur.s = ovr.s; cur.key = ovr.key; cur.local = !!ovr.local; cur.debug = !!ovr.debug; cur.lorenzoSeated = !!ovr.lorenzoSeated; return cur; }
      }
      if (sessDay !== day) { sessDay = day; sessList = [...dipperSessions(day - 1), ...dipperSessions(day)]; for (const q of sessList) q.key = 'S' + q.start.toFixed(4); }
      for (const q of sessList) if (T >= q.start && T < q.end) { cur.t = (T - q.start) * HOUR_S; cur.s = q; cur.key = q.key; cur.local = false; cur.debug = false; cur.lorenzoSeated = false; return cur; }
      return null;
    }
    let curDip = null;

    // ---- Lorenzo's Tesco run: the visit in progress (shared clock: tescoTrips), or a debug override
    let shopOvr = null;                 // { fixed } (debugTesco)
    const curShop = { t: 0, key: '', debug: false };
    let tripDay = NaN, tripList = [];
    function currentShop(T, day) {
      if (shopOvr) { curShop.t = shopOvr.fixed; curShop.key = 'DT' + shopOvr.fixed; curShop.debug = true; return curShop; }
      if (tripDay !== day) { tripDay = day; tripList = [...tescoTrips(day - 1), ...tescoTrips(day)]; for (const q of tripList) q.key = 'T' + q.start.toFixed(4); }
      for (const q of tripList) if (T >= q.start && T < q.end) { curShop.t = (T - q.start) * HOUR_S; curShop.key = q.key; curShop.debug = false; return curShop; }
      return null;
    }
    let curShopV = null;

    // ---- Miguel's hal: the trip on now (shared clock: halTrips), or a debug override (debugHal); the player's "yes" (local)
    let halOvr = null;                  // { trip, startMs | fixed }
    let halDay = NaN, halList = [];
    const curHour = () => (dbgHour !== null ? dbgHour : game.time.hour);
    function halTripNow(T, day, lead = 0) {
      if (halDay !== day) { halDay = day; halList = [...halTrips(day - 1), ...halTrips(day)]; }
      for (const q of halList) if (T >= q.go - lead && T < q.out) return q;
      return null;
    }
    /** the trip he has not gone in for yet, setting off within 36 real seconds or already under way */
    const halSoon = () => { const day = dayIdx(), T = day * 24 + curHour(), q = halTripNow(T, day, 36 / HOUR_S); return q && T < q.inT ? q : null; };
    let halOfferUntil = 0, halWith = null, halNudge = 0;
    const halOffer = () => { if (performance.now() >= halOfferUntil) return false; const q = halSoon(); return !!q && !(halWith && halWith.key === q.key); };
    function acceptHal(m) {
      const q = halSoon(); if (!q) return;
      halWith = q; halOfferUntil = 0;
      sayAll(m, HAL_ACCEPT, 3);
      game.ui.objective('Go to hal with Miguel: he is heading for the Hall door in the loggia');
    }
    // with the player who said yes: in through the door together when he goes in; a nudge if they fall behind
    function halFollow(m, T) {
      const q = halWith, pl = game.player;
      const done = (msg) => { halWith = null; game.ui.objective(null); if (msg) game.ui.toast(msg, 3); };
      if (!m || T >= q.out || pl.place === 'worcint_hall') { done(null); return; }
      if (T >= q.inT && m.hidden && m.inRoom === 'worcint_hall') {
        const D = N.HALL_D, d = Math.hypot(pl.pos.x - D[0], pl.pos.z - D[1]);
        if (pl.place === 'world' && d < 9 && !pl.vehicle && !game.activity) { done('Miguel holds the door for you.'); if (!defOf('worcint_hall')) game.interiors.enter('worcint_hall'); }
        else done('Miguel has gone in to hal without you.');
        return;
      }
      if (m.shown && m.walking && !m.ch.saying) {
        const pw = pworld(), d = Math.hypot(pw.x - m.pos.x, pw.z - m.pos.z), t = performance.now();
        if (d > 12 && t > halNudge) { halNudge = t + 15000; sayAll(m, HAL_INVITE[2], 3); }
      }
    }
    // {name} in an invitation: a friend standing with him, else the player
    function fmtInvite(n, line) {
      if (!line.includes('{name}')) return line;
      const who = addressee(n, 22);
      return who ? line.replace(/\{name\}/g, who) : fmt(line);
    }
    const friendNear = (n) => npcs.some((m) => m !== n && !m.hidden && !m.taken && m.P.kind === 'friend' && Math.hypot(m.x + m.offX - n.x - n.offX, m.z + m.offZ - n.z - n.offZ) < 6);
    let hal = null, halState = null, halErr = false;

    // ---- tagging along with a player (_friends_follow.js)
    // booked: an entry of the timeline that is a scene or an appointment (cooking / eating chicken dippers, hal, the Tesco
    // run, a night out, parkour, bed). Someone tagging along leaves in time to walk back for it, and nobody sets off with
    // you with one of these less than an hour away.
    const booked = (e) => !!(e.dip || e.session || e.trip || e.shopGo || e.inShop || (e.night && e.spot === 'town') || SPOTS[e.spot].parkour !== undefined
      || e.spot === 'halGo' || e.spot === 'halIn' || e.spot === 'earlIn' || ((e.spot === 'home' || e.spot === 'earl' || e.spot === 'gone') && (e.h >= 22 || e.h < 6)));
    const nowT = () => dayIdx() * 24 + curHour();
    /** the next booked entry of n's day (from the one he is in), or null */
    function nextBooked(n) { const tl = n.tl; if (!tl) return null; for (let i = n.entry; i < tl.length; i++) if (booked(tl[i])) return tl[i]; return null; }
    const hoursTo = (n) => { const e = nextBooked(n); return e ? Math.max(0, e.T - nowT()) : 99; };
    const FOL_LINES = {}; for (const id of ids) FOL_LINES[id] = (LINES[id] || []).filter((t) => !t.includes('{name}'));
    /** from (x, z) back to where the routine has him (null: no way known from that point): to the nearest node of the friends' graph he can walk straight to
     *  (over the pavements first if that is a long way off), along the graph, then to the spot */
    function backPath(n, x, z, R) {
      const col = game.worldCollider, see = (a, b, c, d) => !col || col.raycast(a, b, c, d, { ignoreLow: false }) === null;
      if (Math.hypot(R.x - x, R.z - z) < 25 && see(x, z, R.x, R.z)) return [[R.x, R.z]];
      const nearest = (px, pz) => {
        const c = []; for (let i = 0; i < names.length; i++) { const q = N[names[i]]; c.push([Math.hypot(q[0] - px, q[1] - pz), i]); }
        c.sort((a, b) => a[0] - b[0]);
        for (let k = 0; k < 6 && k < c.length; k++) { const q = N[names[c[k][1]]]; if (c[k][0] < 70 && see(px, pz, q[0], q[1])) return c[k][1]; }
        // (… or one with only a low wall / a step's edge between, as his own walks from a door node to the door have)
        for (let k = 0; k < 4 && k < c.length; k++) { const q = N[names[c[k][1]]]; if (c[k][0] < 20 && (!col || col.raycast(px, pz, q[0], q[1]) === null)) return c[k][1]; }
        return -1 - c[0][1];
      };
      // (no node in a straight line — a wall between — or a long way to it: over the pavements to the nearest one)
      let a = nearest(x, z), b = nearest(R.x, R.z); const blind = a < 0; if (a < 0) a = -1 - a; if (b < 0) b = -1 - b;
      const A = N[names[a]], pts = [];
      // (a wall between him and every node near by: no way from here — the caller walks him back along his own steps first)
      if (blind && Math.hypot(A[0] - x, A[1] - z) <= 25) return null;
      if ((blind || Math.hypot(A[0] - x, A[1] - z) > 25) && ped && ped.route) { let r = null; try { r = ped.route(x, z, A[0], A[1]); } catch { r = null; } if (r) pts.push(...r); }
      pts.push(...nodePath(names[a], names[b]), [R.x, R.z]);
      return pts;
    }
    function followSay(n, kind, why, seed0) {
      if (!n.shown || n.ch.isDown) return;
      const C = CATCH[n.id] || {}, seed = (Number.isFinite(seed0) ? seed0 : Math.floor(game.time.now() / 4000)) + n.pi;      // (seed0: the leader's, sent with the news, so everyone hears the same words)
      const wave = () => { try { n.ch.setPose('wave', { duration: 1.6 }); } catch (e) { /* */ } };
      if (kind === 'join') { if (C.join && hash01(seed * 0.91) < 0.75) bubble(n, pick(C.join, seed), 2.6, true); else wave(); return; }
      // (left behind by a player who ran off: "Right, I'm off.", or just a wave after them)
      if (why === 'bike' || why === 'wave' || (why === 'behind' && hash01(seed * 0.37) < 0.4)) { wave(); return; }
      let line = null;
      if (why === 'car') line = C.car && C.car[0];
      else if (why === 'routine') { const e = nextBooked(n); line = n.id === 'miguel' && e && (e.spot === 'halGo' || e.spot === 'halIn') ? MIGUEL_OFF.hal : n.id === 'miguel' && e && e.dip ? MIGUEL_OFF.dip : C.must && C.must[0]; }
      else if (why === 'late' && n.id === 'miguel') line = CATCH.miguel.home[0];
      else line = C.leave && pick(C.leave, seed);
      if (line) bubble(n, line, 3, true); else wave();
    }
    const crew = new FollowCrew(game, {
      npcs, home: N.LODGE, range: 900, seatAt, seatCount, walk: (n) => n.speed,
      at: (n) => n.pos,
      avail(n, talking) {
        if (dbg || n.taken || !n.shown || n.hidden || n.downT > 0 || n.ch.isDown || n.act >= 0 || n.segKind !== undefined || n.rm || n.fol || !n.side) return null;
        if (n.hold && !talking) return null;
        const e = n.tl && n.tl[n.entry]; if (!e || booked(e)) return null;
        if (SPOTS[e.spot].hidden && !n.walking) return null;      // (at the gate / a door, about to go)
        if (n.id === 'miguel' && halWith) return null;
        return { hFree: hoursTo(n), walking: n.walking };
      },
      commit: (n) => hoursTo(n),
      routine: (n) => n.rt,
      // (someone who is out tonight stays out with you until the night ends; the rest turn in at one)
      late: (n) => { const no = nightOut(dayIdx() - (curHour() < 6 ? 1 : 0)); return no && no.ids.includes(n.id) ? 26.5 : 25; },
      // the Purple Turtle: in with you if it is their night out, or it is late enough and they are the sort; else they wait outside
      enters(n, room) {
        if (room !== 'purple_turtle') return true;
        const h = curHour(), no = nightOut(dayIdx() - (h < 6 ? 1 : 0));
        return (h >= 20 || h < 3) && ((no && no.ids.includes(n.id)) || (SOCIABLE[n.id] || 0) >= 0.6);
      },
      back: backPath, say: followSay,
    });
    /** after the routine has placed n: is he with a player (or on his way back)? then that is where he is */
    function tag(n, dt) {
      const R = n.rt, S = SPOTS[n.spot];
      if ((n.hidden || n.rm) && S) { const q = N[S.node]; R.x = q[0]; R.z = q[1]; } else { R.x = n.x; R.z = n.z; }
      R.hidden = n.hidden; R.seen = n.shown;
      const st = dbg ? null : crew.step(n, dt, R);
      if (!st) { if (n.fol) { n.fol = null; n.folEnd = true; } return false; }
      n.fol = st.mode; n.rspot = n.spot; n.spot = 'follow';
      n.x = st.x; n.z = st.z; n.y = 0; n.h = st.h; n.hidden = false; n.walking = st.v > 0.1; n.arrived = false;
      // (drawn at a walk whatever the pace: the gait starts to run above GAIT_MAX)
      n.animSpeed = st.v; n.gait = st.v > GAIT_MAX ? GAIT_MAX : -1; n.act = -1; n.segKind = undefined; n.inKitchen = false; n.inShop = false; n.inRoom = null; n.pose = st.pose;
      n.rm = null; n.yg = 1;
      if (st.room && Number.isFinite(st.y)) { const d = defOf(st.room); if (d) { n.rm = st.room; n.yl = st.y - d.sl.base(); n.yg = 0; } }
      return true;
    }

    // ---- per-frame
    function update(dt) {
      const pl = game.player, hour = dbgHour !== null ? dbgHour : game.time.hour, now = game.time.now();
      const day = dayIdx(), T = day * 24 + hour;
      if (!(dt > 0)) dt = 0; else if (dt > 0.1) dt = 0.1;
      curDip = currentDip(T, day);
      curShopV = currentShop(T, day);
      scanPlayers();
      crew.off = !!dbg;
      try { crew.update(dt, hour, T); } catch (e) { if (!folErr) { folErr = true; console.warn('[friends] follow', e); } }
      { const nowMs = performance.now(); if (nowMs >= takenT) { takenT = nowMs + 500; updateTaken(); } }   // wall clock: must not lag at low frame rates
      // (in a walk-in room the player's pos is in the room's frame: worldPos is the true position; the friends are then
      //  seen through its windows and doorway, and inside it)
      const curI = game.interiors && game.interiors.current, pS = curI && curI.sl && pl.place === curI.id && pl.worldPos ? curI.sl : null, pRoom = pS ? curI.id : null;
      const pwx = pS ? pl.worldPos.x : pl.pos.x, pwy = pS ? pl.worldPos.y : pl.pos.y, pwz = pS ? pl.worldPos.z : pl.pos.z;
      const inWorld = pl.place === 'world' || !!pS;
      // a walk-in room registered / built since the timelines were made: make them again (the legs depend on it)
      { let sig = 0; const I = game.interiors; if (I && I.get) for (let k = 0; k < ROOM_IDS.length; k++) { const q = I.get(ROOM_IDS[k]); if (q && q.sl) sig += (q.built && q.scene ? 2 : 1) * Math.pow(3, k); }
        if (sig !== roomSig) { roomSig = sig; for (let k = 0; k < npcs.length; k++) { npcs[k].tlDay = NaN; npcs[k].legs.clear(); } } }
      const W = game.world && game.world.groundHeight ? game.world : null;
      for (let i = 0; i < npcs.length; i++) {
        const n = npcs[i], ch = n.ch, g = ch.group;
        if (n.downT > 0) {
          // knocked over by the player's bike/car: lie there, get up, then the schedule (and the offset smoothing) resumes
          n.downT -= dt; n.x = n.downX - n.offX; n.z = n.downZ - n.offZ; n.y = 0; n.pose = 'fall'; n.act = -1; n.animSpeed = 0; n.gait = -1; n.walking = false;
          if (n.downT <= 0) { n.downT = 0; n.pose = 'stand'; }
        } else if (!n.hold && rtalkOn(n)) {
          // another player is talking to them: stand still, turned to that player
          const q = playerById(n.rtalk.p);
          n.pose = 'talk'; n.animSpeed = 0; n.gait = -1; n.act = -1; n.y = 0; n.walking = false;
          if (q) n.h = angTo(q.x - n.x - n.offX, q.z - n.z - n.offZ);
        } else if (!n.hold) {
          place(n, T, day);
          let tagged = false;
          try { tagged = tag(n, dt); } catch (e) { if (!folErr) { folErr = true; console.warn('[friends] follow', e); } }
          // smooth over discontinuities (end of a talk, leaving a parkour session mid-run, the last step of the walk back
          // from tagging along): decay an offset
          if (tagged) { n.offX = 0; n.offZ = 0; }
          else if (n.shown && !dbg) {
            const jx = n.lastX - (n.x + n.offX), jz = n.lastZ - (n.z + n.offZ), j2 = jx * jx + jz * jz;
            if ((j2 > 0.6 || n.folEnd) && j2 < 64) { n.offX += jx; n.offZ += jz; } else if (j2 >= 64) { n.offX = 0; n.offZ = 0; }
          } else { n.offX = 0; n.offZ = 0; }
          n.folEnd = false;
          const k = Math.min(1, dt * 1.2);
          n.offX -= n.offX * k; n.offZ -= n.offZ * k;
          if (dbg) { n.offX = 0; n.offZ = 0; }
        } else {
          // held in conversation: stand still and face the player
          n.pose = 'talk'; n.animSpeed = 0; n.gait = -1; n.act = -1; n.y = 0;
          n.h = angTo(pwx - n.x - n.offX, pwz - n.z - n.offZ);
        }
        let x = n.x + n.offX, z = n.z + n.offZ;
        n.lastX = x; n.lastZ = z;
        // Two of them on one line at one moment (several set off for the bar together and their paths meet at its door)
        // used to be drawn inside each other — the same spot to the centimetre for a few seconds. Out of doors each
        // is now eased a little to one side of anybody within 0.62 m (apart along the line between them; on the same
        // spot: the later in the list to the right of his heading), never into a wall. Drawn positions only: the
        // timetable, who hears whom and where they end up are untouched; every client works it out the same.
        {
          let sx = 0, sz = 0;
          if (!n.hidden && !n.taken && !n.rm && n.act < 0 && n.y < 0.3) for (let j = 0; j < npcs.length; j++) {
            const m = npcs[j]; if (m === n || m.hidden || m.taken || m.rm || !(m.lastX === m.lastX)) continue;
            const ex = x - m.lastX, ez = z - m.lastZ, d2 = ex * ex + ez * ez; if (d2 >= 0.3844) continue;
            const d = Math.sqrt(d2), push = (0.62 - d) * 0.5;
            if (d > 0.04) { sx += (ex / d) * push; sz += (ez / d) * push; } else { const sg = i > j ? 1 : -1; sx += Math.cos(n.h) * sg * push; sz -= Math.sin(n.h) * sg * push; }
          }
          if (sx !== 0 || sz !== 0) { const c = game.worldCollider; if (c && c.isFree && !c.isFree(x + sx, z + sz, 0.26)) { sx = 0; sz = 0; } }
          const ks = Math.min(1, dt * 7);
          n.sepX = (n.sepX || 0) + (sx - (n.sepX || 0)) * ks; n.sepZ = (n.sepZ || 0) + (sz - (n.sepZ || 0)) * ks;
          if (Math.abs(n.sepX) + Math.abs(n.sepZ) < 1e-4) { n.sepX = 0; n.sepZ = 0; }
          x += n.sepX; z += n.sepZ;
        }
        // follow terraces / steps (sampled a few times a second, like the pedestrians); parkour heights are absolute
        // (resampled at once after a jump — debug line-up, leaving the Earl kitchen — so no stale terrace height lingers)
        // (like systems/pedestrians.js: resampled every 0.15 m walked — or 1.5 s, for things that change under a standing
        //  figure — then eased, so a kerb is a small quick rise and never a pop)
        const mx = x - n.gyX, mz = z - n.gyZ, jumped = Math.abs(mx) + Math.abs(mz) > 1.5;
        if (jumped || mx * mx + mz * mz > 0.0225 || (n.gyT -= dt) <= 0) {
          n.gyT = 1.5 + (i % 4) * 0.05; n.gyX = x; n.gyZ = z; const gh = W ? W.groundHeight(x, z) : 0; n.gy = Number.isFinite(gh) ? gh : 0;
          if (jumped || n.gyE !== n.gyE) n.gyE = n.gy;
        }
        const dgy = n.gy - n.gyE;
        if (dgy !== 0) n.gyE = Math.abs(dgy) < 0.002 || Math.abs(dgy) > 0.7 ? n.gy : n.gyE + dgy * Math.min(1, dt * 14);
        // (on a walk-in leg: the room's floor — its frame's base + the leg's height — easing to the ground on the threshold)
        const rd = n.rm ? defOf(n.rm) : null;
        if (rd) n.y = (rd.sl.base() + n.yl) * (1 - n.yg) + n.gyE * n.yg;
        else if (n.act < 0 && n.segKind !== 'balance' && n.y < 0.05) n.y = n.gyE;
        n.pos.set(x, n.y, z);
        // where he is in the player's frame (the [E] prompt), and whether they are on the same side of the wall
        if (pS) { pS.toLocal(x, z, _l3); n.ipos.set(_l3[0], n.y - pS.base(), _l3[1]); } else n.ipos.copy(n.pos);
        n.side = (rd ? n.rm : null) === pRoom || n.yg > 0;
        if (n.handle.place !== pl.place) { n.handle.place = inWorld ? pl.place : 'world'; if (n.handle2) n.handle2.place = n.handle.place; }
        // Miguel sets off home to the Earl Building at the end of the evening (or of a night out): his catchphrase, once
        if (n.id === 'miguel' && n.tl) {
          const e = n.tl[n.entry];
          if (e && e.T !== n.lastEntryT) {
            if (n.lastEntryT === n.lastEntryT && e.spot === 'earl' && !e.dip && (e.h >= 21 || e.h < 4.5)) n.homeDue = now + 15000;
            n.lastEntryT = e.T;
          }
        }
        const dx = pwx - x, dz = pwz - z, d = Math.sqrt(dx * dx + dz * dz);
        n.pd = d;
        const show = inWorld && !n.hidden && !n.taken && d < VIS_FAR;
        n.shown = show;
        g.visible = show;
        if (show && ch.setFade) ch.setFade(d > VIS_FAR - 17 ? Math.max(0.05, (VIS_FAR - d) / 17) : 1);      // (thinning out over the last 17 m, as the walkers do: no pop at the edge)
        if (!show) { if (n.yangSpeech) n.yangSpeech.reset(true); continue; }
        // solid like the pedestrians: a soft circle the player can't walk through; a bike / car bump knocks them over
        if (d < 1.8 && Math.abs(pwy - n.y) < 1.2 && n.act < 0 && !ch.isDown && n.side) {
          const v = pl.vehicle;
          if (v && v.kind !== 'punt' && !pS) {
            const sp = Math.abs(v.speed || 0), reach = v.kind === 'car' ? 1.7 : 0.85;
            if (sp > 2.2 && d < reach && now - n.knockT > 1500) {
              n.knockT = now; n.downT = 4.3; n.downX = x; n.downZ = z; n.hold = false;
              const vx = Math.sin(v.heading ?? pl.heading), vz = Math.cos(v.heading ?? pl.heading);
              n.hs = Math.atan2(-vx, -vz); n.h = n.hs;
              ch.setPose('stand'); ch.setPose('fall');
              { const t = fmt(pick(KNOCK, Math.floor(now / 1000) + n.pi)); bubble(n, t, 2.5, true); sendLine('friendLine', { n: n.id, k: 'knock', x: +x.toFixed(2), z: +z.toFixed(2), h: +n.hs.toFixed(2), t }); }
              if (v.kind === 'bike') v.speed *= 0.4; else { v.speed *= 0.7; if (v.vx !== undefined) { v.vx *= 0.85; v.vz *= 0.85; } }
            }
          } else if (!v && d < 0.62 && d > 1e-4) {
            const push = 0.62 - d;
            const ax = (dx / d) * push, az = (dz / d) * push;
            if (pS) { pl.pos.x += ax * pS.c - az * pS.s; pl.pos.z += ax * pS.s + az * pS.c; } else { pl.pos.x += ax; pl.pos.z += az; }
            game.collider.resolve(pl.pos, pl.radius || 0.32);
          }
        }
        // turn smoothly (the walk heading is per segment)
        let dh = n.h - n.hs; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        n.hs += dh * Math.min(1, dt * (n.act >= 0 ? 20 : 8));
        put(n, g, x, n.y, z, n.hs);
        if (n.pose === 'fall-start') { if (ch.pose !== 'fall') ch.setPose('fall', { forward: true }); }
        else if (n.pose === 'fall') { if (ch.pose !== 'fall') ch.setPose('fall', { forward: true }); }
        else if (ch.pose !== n.pose && !((ch.pose === 'clap' || ch.pose === 'wave') && ch.poseDur)) ch.setPose(n.pose);
        ch.act = n.act;
        // greet the player once in a while when they come close
        n.greetT -= dt;
        const close = d < 5 && !n.hold && n.act < 0 && !ch.isDown;
        if (close && !n.near && n.greetT <= 0 && !game.ui.inDialog && !n.yangSpeech) {
          n.greetT = 90; if (!busy(n)) sayAll(n, fmt(pick(greetsFor(n), Math.floor(now / 1000) + n.pi)), 2.5, { g: 1 });      // (by OUR name: we set it off, everyone near hears it)
        }
        n.near = close;
        // Prof. Yang's catchphrases instead of a greeting: when anyone (local or remote player) walks up to him, and now
        // and then on the shared slot clock while someone is near (_friends_yang.js YangSpeech; same line on every client)
        if (n.yangSpeech) {
          const line = n.yangSpeech.step(now, { nearN: playersNear(game, 'world', x, z, 4.5), anyNear: playersNear(game, 'world', x, z, 10) > 0,
            busy: busy(n) || ch.isDown || n.act >= 0 });
          if (line) bubble(n, line, 3.2, true);
        }
        ch.headTurn(close && n.act < 0 ? clamp(Math.atan2(Math.sin(angTo(dx, dz) - n.hs), Math.cos(angTo(dx, dz) - n.hs)), -1.2, 1.2) : 0);
        // friends at the same spot occasionally chat (cosmetic)
        // (multiplayer: one chance per shared 11 s slot, so every client with a player near shows the same line together)
        {
          const cs = Math.floor(now / 11000 + hash01(i * 7.31));
          if (cs !== n.chatS) {
            n.chatS = cs;
            if (hash01(cs * 0.37 + i) < 0.6 && fresh(now, cs, 11000, hash01(i * 7.31)) && !n.walking && n.pose === 'talk' && !busy(n) && n.act < 0 && anyNear(x, z, 30)) bubble(n, pick(CHAT, cs + i), 2.6, true);
          }
        }
        // catchphrases: Lorenzo and the ducks (checked ~3× a second), Miguel off to his room, and the occasional ambient
        // line (Miguel, Taskeen). The duck line depends on where the ducks are, which each client simulates itself, so one
        // client decides (the lowest-id player near him) and tells the others ('friendLine' event); see netLines below.
        if (n.id === 'lorenzo' && (n.duckT -= dt) <= 0) {
          n.duckT = 0.3;
          if (d < 45 && now >= n.duckCool && !n.hold && n.act < 0 && !ch.isDown && !ch.saying && decider(x, z, 45)) {
            const wg = game.worcesterGrounds, pk = game.parks;
            let dd = wg && wg.nearestDuck ? wg.nearestDuck(x, z) : Infinity;
            if (!(dd < DUCK_R) && pk && pk.nearestDuck) dd = pk.nearestDuck(x, z);
            if (dd < DUCK_R) {
              n.duckCool = now + DUCK_COOL_S * 1000 * (1 + 0.2 * hash01(now * 0.001)); bubble(n, CATCH.lorenzo.duck[0], 4);
              if (game.net && game.net.connected) game.net.send('friendLine', { n: n.id, k: 'duck', c: Math.round(n.duckCool) });
            }
          }
        }
        if (n.homeDue) {
          if (now > n.homeDue) n.homeDue = 0;
          else if (!busy(n) && n.act < 0 && !ch.isDown) { n.homeDue = 0; bubble(n, CATCH.miguel.home[0], 3.5, true); }
        }
        const amb = AMBIENT[n.id], ah = AMBIENT_HOURS[n.id];
        if (amb && (!ah || (hour >= ah[0] && hour < ah[1]))) {
          // one chance per shared AMB_S slot (same moment, same line for every client with a player near)
          const as = Math.floor(now / (AMB_S * 1000) + hash01(i * 3.1));
          if (as !== n.ambS) {
            n.ambS = as;
            // (decided from what every client has: the slot, whether ANY player is near, whether anyone is talking to him —
            //  not from our own screen; a line to Aiken goes to Aiken wherever he is, a player's avatar included)
            if (hash01(as * 0.53 + i) < (ah ? ah[2] : n.id === 'lorenzo' ? 0.45 : 0.8) && fresh(now, as, AMB_S * 1000, hash01(i * 3.1)) && !busy(n) && n.act < 0 && !ch.isDown && anyNear(x, z, 22)) {
              const a = n.id === 'miguel' ? whereOf('aiken') : null;
              const toAiken = !!a && Math.hypot(a.x - x, a.z - z) < TO_AIKEN_R && hash01(as * 0.71 + 3) < 0.5;
              bubble(n, toAiken ? TO_AIKEN : pick(ambAt(amb, hour), as * 7 + i), 3.2, true);
            }
          }
        }
        // someone walking with a player who has no ambient lines of their own: one of their ordinary lines now and then
        // (one chance per shared slot: the same line at the same moment on every client)
        if (n.fol === 'follow' && !amb && FOL_LINES[n.id] && FOL_LINES[n.id].length) {
          const fs = Math.floor(now / (FOLLOW_AMB_S * 1000) + hash01(i * 5.3));
          if (fs !== n.folS) {
            n.folS = fs;
            if (hash01(fs * 0.47 + i) < 0.55 && fresh(now, fs, FOLLOW_AMB_S * 1000, hash01(i * 5.3)) && !busy(n) && !ch.isDown) bubble(n, pick(FOL_LINES[n.id], fs + i), 3.2, true);
          }
        }
        // Miguel's hal invitations: one chance per shared HAL_SLOT_S slot (same line, same moment on every client with a
        // player near), likelier around meals and nearly certain while he waits by the Hall door (_friends_logic.js halInvite)
        if (n.id === 'miguel') {
          const hk = Math.floor(now / (HAL_SLOT_S * 1000) + 0.37);
          if (hk !== n.halS) {
            const first = !fresh(now, hk, HAL_SLOT_S * 1000, 0.37); n.halS = hk;
            const line = first ? null : halInvite(hk, hour, n.spot === 'halGo' && n.arrived);
            if (line && !busy(n) && n.act < 0 && !ch.isDown && (anyNear(x, z, 14) || friendNear(n))) {
              bubble(n, fmtInvite(n, line), 3, true);
              if (d < 9 && halSoon()) halOfferUntil = performance.now() + 9000;
            }
          }
        }
        if (d < ANIM_FAR) ch.update(dt, n.gait >= 0 ? n.gait : n.animSpeed); else if (ch.lodTick) ch.lodTick();
      }
      try { dippers.update(dt, curDip); } catch (e) { if (!dipErr) { dipErr = true; console.warn('[friends] dippers', e); } }
      try { tesco.update(dt, curShopV); } catch (e) { if (!shopErr) { shopErr = true; console.warn('[friends] tesco', e); } }
      try { if (yangRooms) yangRooms.update(dt, byId.get('yang')); } catch (e) { if (!yangErr) { yangErr = true; console.warn('[friends] yang rooms', e); } }
      // Miguel in hal (the indoor scene + the cook), and the player who said yes to his invitation
      try {
        const m = byId.get('miguel');
        let hs = null;
        if (halOvr) hs = { trip: halOvr.trip, t: halOvr.fixed !== undefined ? halOvr.fixed : (now - halOvr.startMs) / 1000, taken: false, replay: halOvr.replay || 0 };
        else { const q = halTripNow(T, day); if (q && T >= q.inT) hs = { trip: q, t: (T - q.inT) * HOUR_S - HAL_DOOR_S, taken: !!(m && m.taken) }; }
        halState = hs;
        if (hal) hal.update(dt, hs);
        if (halWith) halFollow(m, T);
      } catch (e) { if (!halErr) { halErr = true; console.warn('[friends] hal', e); } }
    }
    let dipErr = false, shopErr = false, yangErr = false, folErr = false;

    const KNOCK = ['Ow! {name}!', 'Oi! Watch where you\u2019re going!', 'Really, {name}? REALLY?', 'I\u2019m fine. I\u2019m fine. Ow.', 'My dignity!'];
    const CHAT = ['Ha! No way.', 'Did you see the formal menu?', 'I\u2019ve got a tute in an hour.', 'Bar later?', 'Who\u2019s got the key?', 'That essay, though.',
      'Pump Quad at seven?', 'Classic.', 'Honestly.', 'Same.'];

    // ---- the kitchen scene + friends' voices
    const dippers = new DippersScene(game, {
      people: PEOPLE, voices,
      taken: (id) => { const m = byId.get(id); return !!(m && m.taken); },
      me: () => personOf(game.player.look, null),
      tell: (role, t, s) => sendLine('friendLine', { n: 'dippers', k: 'scene', r: role, t, s }),
      startLocal: () => {
        const c = curDip, seated = !!(c && !c.local && c.t >= 4.4 && c.t < 106);
        ovr = { ids: ['lorenzo'], key: 'L' + game.time.now(), s: { guest: null, alarm: false, row: hash01(game.time.now() * 0.001) < 0.34 }, local: true, startMs: game.time.now() - (seated ? 0 : 0), lorenzoSeated: seated };
      },
    });
    const tesco = new TescoVisit(game, { people: PEOPLE, voices, taken: (id) => { const m = byId.get(id); return !!(m && m.taken); } });
    // Prof. Yang inside Worcester rooms (Lodge, Hall, Library, Memorial Room) when his day takes him there
    let yangRooms = null;
    { const y = byId.get('yang'); if (y) yangRooms = new YangRooms(game, { label: y.P.label, voices, talk: () => talk(y), isMeal: () => yangMeal(y) }); }
    // Miguel inside Hall on his hal trips, and the Hall cook at the hot counter
    { const m = byId.get('miguel'); if (m) hal = new HalScene(game, { label: m.P.label, voices, talk: () => talk(m), day: () => dayIdx(),
      tell: (pages) => sendLine('friendLine', { n: 'hall_cook', k: 'pages', p: [].concat(pages).slice(0, 4).map((l) => (typeof l === 'object' && l ? l.text : l)) }) }); }
    // (no V key: "Characters' voices" at 0% on the Esc screen's sound panel turns them off, saved as before in 'gto.friendVoices')

    // ---- API
    game.friends = {
      roster: PEOPLE,
      npcs,
      routes: compiled.map((c) => ({ name: c.R.name, T: c.T, start: c.R.start })),
      /** debugging: [kind, t0, dur, x1, z1, y1] per segment of route r */
      timeline: (r, fail = false) => compiled[r] && (fail ? compiled[r].fail : compiled[r].ok).segs.map((q) => [q.k, +q.t0.toFixed(2), +q.dur.toFixed(2), +q.x1.toFixed(2), +q.z1.toFixed(2), +q.y1.toFixed(2)]),
      whereIs(id) {
        const n = byId.get(id); if (!n) return null;
        const inBar = n.spot === 'bar' && n.arrived, inEarlKitchen = !!n.inKitchen, inTesco = !!n.inShop;
        const inRoom = n.inRoom && n.arrived ? n.inRoom : null;      // Prof. Yang in a Worcester room (interior id)
        return { id, x: n.x + n.offX, y: n.y, z: n.z + n.offZ, spot: n.spot, inBar, inEarlKitchen, inTesco, inRoom,
          place: inEarlKitchen ? 'worcint_earl' : inTesco ? SHOP_ID : inBar ? 'bar' : inRoom || (n.hidden ? null : 'world'), indoor: !n.hidden && n.rm ? n.rm : null, hidden: n.hidden, walking: n.walking, taken: n.taken,
          following: n.fol === 'follow' ? crew.following(id) : null, returning: n.fol === 'return', inHal: inRoom === 'worcint_hall' && n.spot === 'halIn' };
      },
      /** chicken-dippers sessions on game day `day` (default today): [{kind, start, end (absolute hours), guest, alarm}] */
      sessions: (day = dayIdx()) => dipperSessions(day).map((q) => ({ ...q, startHour: +(q.start - q.day * 24).toFixed(3) })),
      /** the night out starting on game day `day` (default today): {ids, start, end (absolute hours)} or null */
      nightOut: (day = dayIdx()) => nightOut(day),
      /** Prof. Yang's routine on game day `day` (default today): [[hour, spot, flags?]]; and the room he is drawn in now */
      yangDay: (day = dayIdx()) => yangRoutine(day),
      yangShownIn: () => yangRooms && yangRooms.shownIn,
      yangIndoor: () => yangRooms && yangRooms.ch && { room: yangRooms.shownIn, x: yangRooms.pos.x, y: yangRooms.pos.y, z: yangRooms.pos.z, pose: yangRooms.ch.pose, saying: yangRooms.ch.saying },
      /** Miguel's hal trips on game day `day` (default today): [{kind, go, inT, out (absolute hours), reply, luck, key, inHour}] */
      halTrips: (day = dayIdx()) => halTrips(day).map((q) => ({ ...q, inHour: +(q.inT - q.day * 24).toFixed(3) })),
      /** the hal scene on now: {trip, t (s into the indoor scene)} + what the Hall figures are doing (when you are in Hall) */
      hal: () => ({ on: halState && { key: halState.trip.key, t: +halState.t.toFixed(2), reply: COOK_REPLY[halState.trip.reply] }, offer: halOffer(), with: halWith && halWith.key, ...(hal ? hal.state() : {}) }),
      /** test hook: run (opts.run) or freeze Miguel's indoor hal scene at t seconds (opts.replay: show the lines of the last n s);
       *  opts.luck / opts.reply pick the cook's answer; 'off' to stop */
      debugHal(t, opts = {}) {
        if (t === 'off' || t === null) { halOvr = null; return 'off'; }
        const reply = opts.reply !== undefined ? opts.reply : opts.luck ? COOK_LUCK : 0;
        const trip = { day: dayIdx(), kind: 'lunch', go: 0, inT: 0, out: 0.85, reply, luck: reply === COOK_LUCK, key: 'D' + Math.round(game.time.now()) };
        halOvr = opts.run ? { trip, startMs: game.time.now() - t * 1000 } : { trip, fixed: t, replay: opts.replay || 0 };
        return { t, reply: COOK_REPLY[reply] };
      },
      /** test hook: open Miguel's hal invitation prompt now (as if he had just asked you) */
      debugHalOffer() { halOfferUntil = performance.now() + 9000; return halOffer(); },
      /** Lorenzo's Tesco runs on game day `day` (default today): [{start, end (absolute hours), startHour}] */
      tescoTrips: (day = dayIdx()) => tescoTrips(day).map((q) => ({ ...q, startHour: +(q.start - q.day * 24).toFixed(3) })),
      /** the Tesco visit running now: {t (s since start), debug} or null */
      tesco: () => curShopV && { t: curShopV.t, debug: curShopV.debug, events: tesco.events() },
      /** test hook: freeze Lorenzo's Tesco visit at t seconds (or a named moment: jaffa take scan out); 'off' to stop */
      debugTesco(t) {
        if (t === 'off' || t === null) { shopOvr = null; return 'off'; }
        const ev = tesco.events();
        const tt = typeof t === 'number' ? t : ev && ev[t];
        if (!Number.isFinite(tt)) return ev ? Object.keys(ev) : 'enter the shop first (events come from its fixtures)';
        shopOvr = { fixed: tt }; tesco.resetLines(tt - 0.5);
        return { t: tt, events: ev };
      },
      /** a punch thrown by the local player (systems/punch.js): (x, z) and the way (fx, fz) in the PLAYER's frame. The
       *  nearest friend drawn on our side of the wall within `reach` m and inside the cone (cos) goes over as a bike
       *  bump puts him over (the same fall, up in 4.3 s, one of his own KNOCK lines, sent to the others as 'friendLine'
       *  knock). Nobody mid-parkour, nobody already down. probe: only say who it would be. -> { id, d } | null */
      punch(x, z, fx, fz, reach = 1.25, cos = 0.5, probe = false) {
        let best = null, bd = reach;
        for (const n of npcs) {
          if (!n.shown || !n.side || n.act >= 0 || n.ch.isDown || n.downT > 0) continue;
          const ex = n.ipos.x - x, ez = n.ipos.z - z, d = Math.hypot(ex, ez);
          if (d < bd && d > 1e-3 && (ex * fx + ez * fz) / d >= cos) { bd = d; best = n; }
        }
        if (!best) return null;
        const n = best, now = game.time.now();
        if (probe || now - n.knockT < 1500) return { id: n.id, d: bd, down: false };
        const curI = game.interiors && game.interiors.current, pS = curI && curI.sl && game.player.place === curI.id ? curI.sl : null;
        n.knockT = now; n.downT = 4.3; n.downX = n.pos.x; n.downZ = n.pos.z; n.hold = false;
        n.hs = Math.atan2(-fx, -fz) + (pS && Number.isFinite(pS.rot) ? pS.rot : 0); n.h = n.hs;      // (facing whoever hit him)
        n.ch.setPose('stand'); n.ch.setPose('fall');
        const t = fmt(KNOCK[[0, 2, 3, 4][Math.floor(hash01(Math.floor(now / 1000) + n.pi) * 4) % 4]]);
        bubble(n, t, 2.5, true); sendLine('friendLine', { n: n.id, k: 'knock', x: +n.pos.x.toFixed(2), z: +n.pos.z.toFixed(2), h: +n.hs.toFixed(2), t });
        return { id: n.id, d: bd, down: true, line: t };
      },
      /** test hook: knock a friend over as if hit by a bike */
      debugKnock(id) { const n = byId.get(id); if (!n || !n.shown) return false; n.knockT = game.time.now(); n.downT = 4.3; n.downX = n.x + n.offX; n.downZ = n.z + n.offZ; n.ch.setPose('stand'); n.ch.setPose('fall'); return true; },
      /** the kitchen session running now: {t (s since start), s, local, debug} or null */
      dippers: () => curDip && { t: curDip.t, s: curDip.s, local: curDip.local, debug: curDip.debug },
      voices,
      /** tagging along (_friends_follow.js FollowCrew): follow.debugJoin(id), follow.debugLeave(id, why), follow.state(id), follow.dbgForce = p */
      follow: crew,
      /** test hook: freeze the kitchen scene at a stage (or a time in seconds) with Miguel + Lorenzo (+ opts.guest) in it.
       *  stages: freezer offer reply shake oven timer drinks cooking peek wait mitts takeout plate ketchup carry serve shicken eat inspect row end; 'off' to stop. opts: {guest:'kotaro', alarm:true, row:true} */
      debugDippers(stage, opts = {}) {
        if (stage === 'off' || stage === null) { ovr = null; return 'off'; }
        const T = { freezer: 6, offer: 8.6, reply: 12.0, shake: 15.6, oven: 19.0, timer: 21.0, drinks: 27.6, cooking: 32, peek: 42.5, wait: 45, mitts: 47.9, takeout: 51.0, plate: 57.0, ketchup: 59.0, carry: 62.0, serve: 64.0, shicken: 66.3, eat: 75, inspect: 80.8, row: 82.8, end: 108 };
        const t = typeof stage === 'number' ? stage : T[stage];
        if (!Number.isFinite(t)) return Object.keys(T);
        const guest = opts.guest === undefined ? null : opts.guest;
        ovr = { ids: ['miguel', 'lorenzo', ...(guest ? [guest] : [])], guest, key: 'D' + t + (guest || '') + (opts.alarm ? 'A' : '') + (opts.row ? 'R' : ''), s: { guest, alarm: !!opts.alarm, row: !!opts.row }, debug: true, fixed: t };
        return { stage, t };
      },
      taken: (id) => { const n = byId.get(id); return !!(n && n.taken); },
      /** test hook: everyone in a row centred at (x,z), facing heading h; pass order to choose who/which order */
      debugLineup(x, z, h = 0, opts = {}) { dbg = { mode: 'lineup', x, z, h, gap: opts.gap || 1.0, pose: opts.pose, order: opts.order || ids.slice() }; return ids; },
      /** test hook: Kotaro at time t (s) of route r (0 wall, 1 Provost's Lane, 2 Gloucester Green); fail=true for the tumble variant */
      debugParkour(r, t, fail = false) { dbg = { mode: 'parkour', route: r, t, fail }; const n = byId.get('kotaro'); if (n) n.segIdx = -1; return compiled[r] ? { T: compiled[r].T, x: n.x, y: n.y, z: n.z } : null; },
      debugHour(h) { dbgHour = h; },
      debugOff() { dbg = null; dbgHour = null; ovr = null; shopOvr = null; halOvr = null; },
      /** checks every graph edge against walls and water: returns the problems */
      debugGraph() {
        const col = game.worldCollider, bad = [];
        for (const [a, b] of E) {
          const A = N[a], B = N[b];
          const t = col.raycast(A[0], A[1], B[0], B[1]);
          if (t !== null) bad.push(`${a}-${b} wall at ${t.toFixed(2)}`);
          for (let s = 0; s <= 10; s++) { const x = lerp(A[0], B[0], s / 10), z = lerp(A[1], B[1], s / 10); if (col.isWet(x, z)) { bad.push(`${a}-${b} wet at ${x.toFixed(1)},${z.toFixed(1)}`); break; } }
        }
        return bad;
      },
    };

    return { update };
  },
};
