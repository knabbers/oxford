// The rules of vehicle sound, apart from the audio graph so that they can be tested without one (tools/smoke_ambience.mjs).
// systems/_vehicle_audio.js plays what these say.
//
// A vehicle's SOUND KIND is not its model: car (petrol), ev (electric: a whine and tyres, no engine — one car in seven,
// by its id, a guess at the present-day share on an Oxford street), taxi and van (diesel: lower, with a clatter), bus (a
// big diesel an octave down), bike (tyre hum and the freewheel's tick). There are no scooters or e-bikes in the game.
//
//   idle / span   firing note at idle and how far it climbs through a gear (Hz); the voice plays its octave (a sawtooth)
//                 over it (a square, at level "sub"), so that most of the engine is above 100 Hz, where a small
//                 loudspeaker can reproduce it
//   cut           low-pass on the engine at idle; it opens with load and speed
//   level         engine level (source gain; the distance is the panner's business — core/audio.js class 'vehicle')
//   clatter/rate  diesel: depth and speed of the amplitude wobble
//   road          tyre / road noise per m/s, and its ceiling
//   whine         ev: sine whine level; Hz per m/s
export const PROFILE = {
  car: { idle: 46, span: 64, cut: 900, level: 0.06, clatter: 0, rate: 0, road: 0.0058, roadMax: 0.11, whine: 0, sub: 0.3 },
  ev: { idle: 0, span: 0, cut: 900, level: 0, clatter: 0, rate: 0, road: 0.0058, roadMax: 0.11, whine: 0.008, sub: 0 },
  taxi: { idle: 39, span: 50, cut: 760, level: 0.064, clatter: 0.3, rate: 11, road: 0.0058, roadMax: 0.11, whine: 0, sub: 0.35 },
  van: { idle: 35, span: 46, cut: 700, level: 0.068, clatter: 0.35, rate: 10, road: 0.0062, roadMax: 0.12, whine: 0, sub: 0.35 },
  bus: { idle: 25, span: 34, cut: 520, level: 0.085, clatter: 0.5, rate: 8, road: 0.0075, roadMax: 0.14, whine: 0, sub: 0.45 },
  bike: { idle: 0, span: 0, cut: 900, level: 0, clatter: 0, rate: 0, road: 0.0045, roadMax: 0.035, whine: 0, sub: 0 },
};
export const KINDS = Object.keys(PROFILE);
export const MAX_VOICES = 6;          // traffic (and other players') vehicles heard at once
export const RANGE = 75;              // m: beyond this a vehicle is not given a voice
export const BIKE_RANGE = 16;
export const SOUND_SPEED = 343;
export const TRAFFIC_LEVEL = 0.8;     // the traffic's voices against the driver's own
/** many at once are each turned down, so that a busy junction is a street and not a wall: 1 for one or two, 0.5 for six */
export function crowdLevel(heard) { return TRAFFIC_LEVEL / Math.sqrt(Math.max(1, heard / 1.5)); }

/** which sound a vehicle makes: a = { kind: 'car' | 'bike', type: 'car' | 'car_hatch' | 'taxi' | 'van' | 'bus' | 'bike…', uid } */
export function soundKind(a) {
  if (!a) return 'car';
  const t = String(a.type || a.kind || 'car');
  if (a.kind === 'bike' || t.startsWith('bike')) return 'bike';
  if (t === 'bus') return 'bus';
  if (t === 'taxi') return 'taxi';
  if (t === 'van') return 'van';
  const id = (a.uid ?? a.id ?? 0) | 0;
  return id > 0 && id % 7 === 3 ? 'ev' : 'car';
}

const REV = { hz: 0, gear: 0, k: 0 };
/** the engine's note at a speed (m/s): it climbs through each gear and drops back at the change. -> REV {hz, gear, k (0..1 through the gear)} (shared) */
export function revs(kind, speed, load = 0) {
  const P = PROFILE[kind] || PROFILE.car, sp = Math.abs(speed);
  const gear = sp < 5 ? 0 : sp < 10 ? 1 : sp < 16 ? 2 : 3;
  const k = sp < 5 ? sp / 5 : sp < 10 ? (sp - 5) / 5 : sp < 16 ? (sp - 10) / 6 : Math.min(1, (sp - 16) / 9);
  REV.gear = gear; REV.k = k;
  REV.hz = P.idle + P.span * (0.15 * gear + (0.55 + 0.1 * gear) * k) + P.span * 0.12 * Math.max(0, Math.min(1, load));
  return REV;
}

/** the pitch factor heard from a source closing at vr m/s (positive: coming towards the listener). Kept gentle: a
 *  position that jumps (a packet, a teleport) must not make a siren of an engine. */
export function doppler(vr) {
  if (!isFinite(vr)) return 1;
  const v = Math.max(-30, Math.min(30, vr));
  return Math.max(0.9, Math.min(1.1, SOUND_SPEED / (SOUND_SPEED - v)));
}

/** how loud a vehicle is at its own position, 0..~1.4, for choosing who gets a voice: speed and load, a little for idling */
export function loudness(kind, speed, load = 0, idling = true) {
  const sp = Math.abs(speed);
  if (kind === 'bike') return sp < 1 ? 0 : Math.min(0.35, sp / 20);
  if (sp < 0.3 && !idling) return 0;
  const eng = kind === 'ev' ? 0.05 : (kind === 'bus' ? 0.5 : 0.34) * (0.45 + 0.55 * load);
  return eng + Math.min(0.9, sp / 14);
}

/**
 * Choose who is heard: out[] (length n, objects reused: {a, d, score}) gets the up-to-n candidates with the highest
 * score = loudness / (1 + d / 7), nearest and loudest first. list[i] = { x, z, speed, kind, type, uid, active, parked,
 * load? }. A vehicle that is parked, switched off (active === false) or out of range is never chosen; nor is `skip`
 * (the one the player is driving: it has its own voice). No allocation. -> how many
 */
export function pick(list, lx, lz, n, out, skip = null, range = RANGE) {
  let m = 0;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a || a === skip || a.active === false || a.parked) continue;
    const dx = a.x - lx, dz = a.z - lz;
    if (dx > range || dx < -range || dz > range || dz < -range) continue;
    const d = Math.hypot(dx, dz), kind = a.sk || (a.sk = soundKind(a));
    if (d >= range || (kind === 'bike' && d > BIKE_RANGE)) continue;
    const L = loudness(kind, a.speed || 0, a.load || 0, !a.remote);
    if (L <= 0) continue;
    const score = L / (1 + d / 7);
    let j;
    if (m < n) j = m++; else if (score > out[n - 1].score) j = n - 1; else continue;
    const o = out[j]; o.a = a; o.d = d; o.score = score;
    while (j > 0 && out[j - 1].score < out[j].score) { const t = out[j]; out[j] = out[j - 1]; out[j - 1] = t; j--; }
  }
  for (let j = m; j < n; j++) { out[j].a = null; out[j].score = 0; }
  return m;
}

const SET = { hz: 0, cut: 0, eng: 0, road: 0, roadHz: 0, clatter: 0, rate: 0, whine: 0, whineHz: 0, tick: 0, tickRate: 1, sub: 0 };
/**
 * What a voice should be playing for a vehicle: kind, speed (m/s, signed: negative = reversing), load 0..1 (throttle),
 * braking, pitch factor (doppler), own (the player's own car: a little more engine). -> SET (shared, read at once)
 */
export function voiceSet(kind, speed, load = 0, braking = false, pf = 1, own = false, inside = false) {
  const P = PROFILE[kind] || PROFILE.car, sp = Math.abs(speed), S = SET;
  load = Math.max(0, Math.min(1, +load || 0));
  S.road = Math.min(P.roadMax, sp * P.road); S.roadHz = (kind === 'bike' ? 520 + sp * 60 : 480 + sp * 48) * pf;
  S.tick = 0; S.tickRate = 1; S.whine = 0; S.whineHz = 400; S.clatter = 0; S.rate = 9; S.eng = 0; S.hz = 50; S.cut = P.cut; S.sub = P.sub;
  if (kind === 'bike') {
    const coast = load < 0.5 && sp > 1.2;
    S.tick = coast ? 0.045 : 0; S.tickRate = Math.max(0.35, Math.min(3, sp / 4.5)) * pf;
    return S;
  }
  if (kind === 'ev') {      // a motor whine that rises with speed, louder under load and when slowing (regeneration); a reversing hum
    S.whine = sp < 0.3 ? 0 : P.whine * (0.35 + 0.65 * Math.max(load, braking ? 0.6 : 0)) * Math.min(1, sp / 3);
    S.whineHz = (speed < -0.3 ? 620 : 280 + sp * 52) * pf;
    return S;
  }
  const R = revs(kind, sp, load);
  // reversing: the straight-cut whine of reverse gear rides over the engine
  if (speed < -0.4) { S.whine = 0.012 * Math.min(1, sp / 2); S.whineHz = (500 + sp * 90) * pf; }
  S.hz = R.hz * pf;
  S.cut = (P.cut * (0.75 + 1.5 * load) + sp * 26) * (0.8 + 0.2 * pf);
  // loudest pulling away; cruising, the road takes over; off the throttle it falls to a third (engine braking a little more)
  const pull = 0.3 + 0.7 * load + (braking && sp > 3 ? 0.08 : 0), fade = 1 - 0.45 * Math.min(1, sp / 20);
  S.eng = P.level * pull * fade * (own ? 1.15 : 1);
  S.clatter = P.clatter * (1 - 0.5 * load); S.rate = P.rate + sp * 0.25;
  // heard from a seat inside it (a bus you are riding): the engine through the floor — dull — the road as a rumble, and
  // the fittings rattling with the engine's shake and the speed
  if (inside) { S.cut = Math.min(S.cut, 240 + sp * 6); S.eng *= 1.25; S.roadHz = 190 + sp * 8; S.road *= 0.8; S.tick = 0.004 + Math.min(0.01, sp * 0.0009) + 0.004 * load; S.tickRate = 0.55 + sp * 0.03; S.whine = 0; }
  return S;
}

/** the engine's load of a vehicle of the traffic, from what it is doing: a.acc (m/s², while it gathers speed), else a steady 0.3 when moving */
export function loadOf(a) {
  if (a.load !== undefined) return a.load;
  const sp = Math.abs(a.speed || 0);
  if (a.acc !== undefined) return a.acc > 0.05 ? Math.min(1, 0.35 + a.acc * 0.55) : sp > 0.5 ? 0.22 : 0;
  return sp > 0.5 ? 0.45 : 0;
}
/** how much of the individual vehicles is heard: the ambience's through-the-walls factor in a room (0..1), all of it out of doors */
export function indoorFactor(outdoors, roomOut) {
  if (outdoors) return 1;
  const o = Math.max(0, Math.min(1, +roomOut || 0));
  return o < 0.04 ? 0 : o * 0.6;
}
