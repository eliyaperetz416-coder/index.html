// One step of the whole game: the base first, then the shipyard.

import { tick } from './state.js';
import { tickFleet } from './fleet.js';

/** Advance everything by dt seconds. Returns the ship that just launched, if any. */
export function step(state, dt) {
  tick(state, dt);
  return tickFleet(state, dt, state.status.power * state.status.life);
}
