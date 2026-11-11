// One step of the whole game: the base, the shipyard, the expedition, the war.

import { tick } from './state.js';
import { tickFleet } from './fleet.js';
import { tickExpedition } from './expedition.js';
import { tickWar } from './war.js';

/**
 * Advance everything by dt seconds. Returns what happened this step:
 *   launched    the ship that just left the shipyard, or null
 *   expedition  an expedition event ({ type: 'arrived' | 'leaving' | 'returned', ... }), or null
 *   war         a war event ({ type: 'offer' | 'ignored' | 'round' | 'won' | 'lost', ... }), or null
 */
export function step(state, dt) {
  tick(state, dt);
  return {
    launched: tickFleet(state, dt, state.status.power * state.status.life),
    expedition: tickExpedition(state, dt),
    war: tickWar(state, dt),
  };
}
