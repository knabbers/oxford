// The chase camera's rules (pure; core/game.js _followCamera applies them, tools/smoke_chasecam.mjs tests them).
// Riding or driving, the view swings round behind the vehicle by itself once the mouse has been still for a moment, so
// you steer with A / D and never have to drag the view after every corner; quicker the faster you go; moving the mouse
// takes it back at once. Reversing for a second looks over the back. The lens opens a little with speed, and on a bike
// the view banks with the lean. On foot none of it applies (walking is camera-relative).
export const CHASE = { idle: 1.1, minSpeed: 1.2, minSpeedPunt: 0.5, revSpeed: -1.5, revAfter: 1, fov: 60, fovMax: 11, bank: 0.16 };

/** st: { idle, rev } (kept by the caller, start at 0). veh: null or { kind, heading, speed, lean }. Returns the new yaw. */
export function chaseYaw(st, veh, mouseMoved, dt, yaw, on = true) {
  st.idle = mouseMoved ? 0 : Math.min(60, (st.idle || 0) + dt);
  if (!veh) { st.rev = 0; return yaw; }
  const sp = veh.speed || 0, as = Math.abs(sp);
  st.rev = sp < CHASE.revSpeed ? Math.min(2, (st.rev || 0) + dt) : Math.max(0, (st.rev || 0) - dt * 3);
  if (!on || st.idle <= CHASE.idle || as <= (veh.kind === 'punt' ? CHASE.minSpeedPunt : CHASE.minSpeed)) return yaw;
  let e = veh.heading + (st.rev > CHASE.revAfter ? Math.PI : 0) - yaw;
  e -= Math.round(e / (Math.PI * 2)) * Math.PI * 2;
  const k = Math.min(3.4, 0.7 + as * 0.24) * Math.min(1, (st.idle - CHASE.idle) * 1.5);   // eases in: no lurch
  return yaw + e * (1 - Math.exp(-k * dt));
}
/** field of view wanted at this speed (degrees) */
export function chaseFov(veh) {
  if (!veh || veh.kind === 'punt') return CHASE.fov;
  return CHASE.fov + Math.min(CHASE.fovMax, Math.max(0, Math.abs(veh.speed || 0) - 3) * 0.62);
}
/** camera roll wanted (radians, + = banked left): a bike leaning left (lean < 0) banks the view left */
export function chaseBank(veh) { return veh && veh.kind === 'bike' ? -(veh.lean || 0) * CHASE.bank : 0; }
