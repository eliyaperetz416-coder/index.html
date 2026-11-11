// Expedition rules: send ships to a planet, gather rare resources, fly home. Pure logic.
//
// state.expedition is null, or:
//   { planet, shipIds, phase: 'outbound' | 'onsite' | 'return', remaining, cargo, loot: { rareId: amount },
//     eventsLeft, event }   — event is set while the player must make a choice (see sim/events.js)

import { PLANETS } from '../data/planets.js';
import { canPay, pay } from './state.js';
import { shipStats, shipBusy } from './fleet.js';
import { startEvent, yieldBonus } from './events.js';

/** Supplies needed to send `shipCount` ships to a planet. */
export function expeditionCost(planetId, shipCount) {
  return Object.fromEntries(Object.entries(PLANETS[planetId].supplies).map(([res, amount]) => [res, amount * shipCount]));
}

export const lootTotal = (expedition) => Object.values(expedition.loot).reduce((a, b) => a + b, 0);

export function canLaunch(state, planetId, shipIds) {
  const planet = PLANETS[planetId];
  if (!planet) return { ok: false, reason: 'Pick a planet' };
  if (state.expedition) return { ok: false, reason: 'An expedition is already out' };
  const ships = shipIds.map((id) => state.ships.find((s) => s.id === id));
  if (ships.length === 0) return { ok: false, reason: 'Pick at least one ship' };
  if (ships.some((s) => !s)) return { ok: false, reason: 'No such ship' };
  if (shipIds.some((id) => shipBusy(state, id))) return { ok: false, reason: 'One of those ships is in battle' };
  if (Math.max(...ships.map((s) => s.level)) < planet.minRank) return { ok: false, reason: `${planet.name} needs a level ${planet.minRank} ship` };
  if (!canPay(state, expeditionCost(planetId, ships.length))) return { ok: false, reason: 'Not enough supplies' };
  return { ok: true };
}

export function launchExpedition(state, planetId, shipIds) {
  if (!canLaunch(state, planetId, shipIds).ok) return false;
  pay(state, expeditionCost(planetId, shipIds.length));
  const cargo = shipIds.reduce((sum, id) => sum + shipStats(state.ships.find((s) => s.id === id)).cargo, 0);
  state.expedition = { planet: planetId, shipIds: [...shipIds], phase: 'outbound', remaining: PLANETS[planetId].travel, cargo, loot: {}, eventsLeft: PLANETS[planetId].events, event: null };
  return true;
}

/** Call the fleet home early. Turning around mid-flight only takes as long as you have flown. */
export function recallExpedition(state) {
  const e = state.expedition;
  if (!e || e.phase === 'return') return false;
  const travel = PLANETS[e.planet].travel;
  e.remaining = e.phase === 'outbound' ? travel - e.remaining : travel;
  e.phase = 'return';
  return true;
}

/**
 * Advance the expedition by dt seconds.
 * Returns what just happened, if anything: { type: 'arrived' | 'event' | 'leaving' | 'returned', planet, loot }.
 */
export function tickExpedition(state, dt) {
  const e = state.expedition;
  if (!e || e.event) return null; // nothing out, or waiting for the player to answer an event
  const planet = PLANETS[e.planet];
  e.remaining -= dt;

  if (e.phase === 'onsite') {
    // Events are spread evenly over the stay: with 2 events they come at 1/3 and 2/3 of it.
    const elapsed = planet.stay - e.remaining;
    const nextEventAt = (planet.stay * (planet.events - e.eventsLeft + 1)) / (planet.events + 1);
    if (e.eventsLeft > 0 && elapsed >= nextEventAt) {
      e.eventsLeft--;
      startEvent(state);
      return { type: 'event', planet: e.planet };
    }

    // Gather the planet's rare resources evenly until the cargo holds are full.
    const room = Math.max(0, e.cargo - lootTotal(e));
    const gathered = Math.min(room, planet.yield * yieldBonus(state, e.planet) * dt);
    for (const id of planet.rare) e.loot[id] = (e.loot[id] ?? 0) + gathered / planet.rare.length;
    if (e.remaining > 0 && gathered < room) return null;
    e.phase = 'return';
    e.remaining = planet.travel;
    return { type: 'leaving', planet: e.planet };
  }

  if (e.remaining > 0) return null;
  if (e.phase === 'outbound') {
    e.phase = 'onsite';
    e.remaining = planet.stay;
    return { type: 'arrived', planet: e.planet };
  }
  // Home again: unload.
  const loot = {};
  for (const [id, amount] of Object.entries(e.loot)) {
    loot[id] = Math.round(amount);
    state.rare[id] = (state.rare[id] ?? 0) + loot[id];
  }
  state.expedition = null;
  state.stats.expeditions++;
  return { type: 'returned', planet: e.planet, loot };
}
