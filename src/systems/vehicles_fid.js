// Car fidelity (2026-11): real glass, cabins and people in the vehicles near the camera; indicators, bus doors, wipers.
// The work is in systems/_carfid.js; this is the system that runs it once a frame AFTER traffic.js and vehicles.js have
// put every vehicle where it is this frame (the file name sorts after both). `?carfid=0` / GTO_CARFID=0: nothing is made.
import { CarFid } from './_carfid.js';

export default {
  id: 'vehicles_fid',
  install(game) {
    const F = new CarFid(game);
    game.carfid = {
      get on() { return F.on; }, get tier() { return F.tier; }, get stats() { return F.stats; }, get glass() { return F.glass || null; },
      list: () => F.list(), slotOf: (ref) => F.slotOf(ref), peopleOf: (ref) => F.peopleOf(ref), pending: () => F.pending(), pause: (on) => F.pause(on), _sys: F,
    };
    if (!F.on) return null;
    return { update(dt) { F.update(dt); } };
  },
};
