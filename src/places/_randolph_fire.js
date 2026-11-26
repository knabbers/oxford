// The Randolph Hotel fire schedule (pure, DOM-free; covered by tools/smoke_randolph.mjs).
// Every player agrees: the hotel burns during one 6-real-minute slot of the shared clock in every CYCLE
// (slot % CYCLE === 0), then spends the first minute of the next slot charred under scaffolding and a tarpaulin
// before it "reopens" pristine. Stone pass (2026-11): it used to burn every other slot — half of all play time, its
// black column visible over the Beaumont Street end from across the city (the photo comparison found it in every
// Worcester quad shot); now one slot in eight (every 48 real minutes, ~12% of the time).
export const SLOT_MIN = 6;
export const SLOT_S = SLOT_MIN * 60;
export const CYCLE = 8;
// seconds into a burning slot
export const T_SMOKE = 0, T_CLIMB = 35, T_BLAZE = 80, T_DYING = 290;
// seconds into the following (non-burning) slot
export const T_REOPEN = 60;
export const PHASES = ['smoke', 'climb', 'blaze', 'dying', 'aftermath', 'calm'];
// a representative moment for each forced phase: [burning slot?, seconds into the slot]
const FORCED = { smoke: [true, 18], climb: [true, 58], blaze: [true, 170], burn: [true, 170], dying: [true, 320], aftermath: [false, 25], calm: [false, 200] };

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * State of the fire at shared time `nowMs`. force: null | 'burn' | 'calm' | any phase name.
 * Returns a fresh plain object (call it a few times a second, not per particle).
 */
export function fireState(nowMs, force = null, out = {}) {
  let burnSlot, t, slot;
  if (force && FORCED[force]) { [burnSlot, t] = FORCED[force]; slot = burnSlot ? 0 : 1; }
  else {
    const s = nowMs / (SLOT_S * 1000);
    slot = Math.floor(s);
    t = (s - slot) * SLOT_S;
    burnSlot = ((slot % CYCLE) + CYCLE) % CYCLE === 0;
  }
  let phase;
  if (burnSlot) phase = t < T_CLIMB ? 'smoke' : t < T_BLAZE ? 'climb' : t < T_DYING ? 'blaze' : 'dying';
  else phase = t < T_REOPEN && ((slot % CYCLE) + CYCLE) % CYCLE === 1 ? 'aftermath' : 'calm';
  // fire spread 0..1 (vent -> duct -> roof -> tower), flame intensity, smoke density / darkness
  let progress = 0, flame = 0, smoke = 0, dark = 0;
  if (burnSlot) {
    if (phase === 'smoke') { progress = 0.08 * (t / T_CLIMB); smoke = 0.15 + 0.3 * (t / T_CLIMB); dark = 0.35; flame = 0; }
    else if (phase === 'climb') { const k = (t - T_CLIMB) / (T_BLAZE - T_CLIMB); progress = 0.08 + 0.37 * k; flame = 1; smoke = 0.45 + 0.35 * k; dark = 0.35 + 0.5 * k; }
    else if (phase === 'blaze') { progress = 0.45 + 0.55 * smooth(T_BLAZE, T_BLAZE + 45, t); flame = 1; smoke = 1; dark = 1; }
    else { const k = (t - T_DYING) / (SLOT_S - T_DYING); progress = 1; flame = 1 - smooth(0, 0.85, k); smoke = 1 - 0.65 * k; dark = 1 - 0.85 * smooth(0.1, 0.8, k); }
  } else if (phase === 'aftermath') { const k = t / T_REOPEN; smoke = 0.3 * (1 - k); dark = 0.05; }
  out.phase = phase;
  out.slot = slot;
  out.t = t;                                   // seconds into the current slot
  out.burning = burnSlot;                      // smoke..dying
  out.progress = progress;
  out.flame = flame;
  out.smoke = smoke;
  out.dark = dark;
  out.response = phase === 'climb' || phase === 'blaze' || phase === 'dying' || phase === 'aftermath'; // engines on Beaumont St
  out.evacuated = phase !== 'calm';            // guests outside, cordon tape up
  out.hosing = phase === 'climb' || phase === 'blaze' || phase === 'dying';
  out.charred = phase === 'aftermath';
  out.open = phase === 'calm';                 // you can go in
  // s until the next open/close change
  out.untilNext = burnSlot ? SLOT_S - t + T_REOPEN : phase === 'aftermath' ? T_REOPEN - t : (CYCLE - (((slot % CYCLE) + CYCLE) % CYCLE)) * SLOT_S - t;
  return out;
}

/** bucket-chain mini-task rules */
export const BUCKET = { trips: 3, reward: 5 };
export function bucketStep(task, ev) {
  // task: {carrying, trips, done}; ev: 'grab' | 'throw' | 'stop'
  if (ev === 'stop') { task.carrying = false; return 'stopped'; }
  if (task.done) return 'done-already';
  if (ev === 'grab') { if (task.carrying) return 'already'; task.carrying = true; return 'grabbed'; }
  if (ev === 'throw') {
    if (!task.carrying) return 'empty';
    task.carrying = false; task.trips++;
    if (task.trips >= BUCKET.trips) { task.done = true; return 'reward'; }
    return 'thrown';
  }
  return 'noop';
}
