// Fleet rules: building ships at the Shipyard and upgrading them. Pure logic, like state.js.

import { SHIPS, MAX_LEVEL, FLEET_PER_SHIPYARD, QUEUE_MAX } from '../data/ships.js';
import { canPay, pay } from './state.js';

export const shipyardCount = (state) => state.modules.filter((m) => m.type === 'shipyard').length;
export const fleetCap = (state) => shipyardCount(state) * FLEET_PER_SHIPYARD;

/** A ship's real stats at its current level: +50% per level above 1. */
export function shipStats(ship) {
  const def = SHIPS[ship.type];
  const scale = 1 + 0.5 * (ship.level - 1);
  return {
    cargo: Math.round(def.cargo * scale),
    attack: Math.round(def.attack * scale),
    hull: Math.round(def.hull * scale),
  };
}

/** Fleet rank = your best ship's level. Later this unlocks farther, more dangerous systems. */
export const fleetRank = (state) => state.ships.reduce((best, s) => Math.max(best, s.level), 0);

export function canQueueShip(state, type) {
  if (!SHIPS[type]) return { ok: false, reason: 'Unknown ship' };
  if (shipyardCount(state) === 0) return { ok: false, reason: 'Build a Shipyard first' };
  if (state.queue.length >= QUEUE_MAX) return { ok: false, reason: 'Build queue is full' };
  if (state.ships.length + state.queue.length >= fleetCap(state)) return { ok: false, reason: 'Fleet is full — build another Shipyard' };
  if (!canPay(state, SHIPS[type].cost)) return { ok: false, reason: 'Not enough resources' };
  return { ok: true };
}

/** Pay for a ship and add it to the build queue. Returns true if it worked. */
export function queueShip(state, type) {
  if (!canQueueShip(state, type).ok) return false;
  pay(state, SHIPS[type].cost);
  state.queue.push({ type, remaining: SHIPS[type].buildTime });
  return true;
}

/** Price to take a ship from its current level to the next: level 1→2 costs 1× the ship, 2→3 costs 2×. */
export function upgradeCost(ship) {
  return Object.fromEntries(Object.entries(SHIPS[ship.type].cost).map(([res, amount]) => [res, amount * ship.level]));
}

export function canUpgradeShip(state, id) {
  const ship = state.ships.find((s) => s.id === id);
  if (!ship) return { ok: false, reason: 'No such ship' };
  if (shipyardCount(state) === 0) return { ok: false, reason: 'Build a Shipyard first' };
  if (ship.level >= MAX_LEVEL) return { ok: false, reason: 'Already at max level' };
  if (!canPay(state, upgradeCost(ship))) return { ok: false, reason: 'Not enough resources' };
  return { ok: true };
}

export function upgradeShip(state, id) {
  if (!canUpgradeShip(state, id).ok) return false;
  const ship = state.ships.find((s) => s.id === id);
  pay(state, upgradeCost(ship));
  ship.level++;
  return true;
}

/**
 * Work on the first ship in the queue. `speed` is how well the base is running (0–1);
 * more Shipyards build faster. Returns the ship that just launched, if any.
 */
export function tickFleet(state, dt, speed) {
  const job = state.queue[0];
  if (!job) return null;
  job.remaining -= dt * speed * shipyardCount(state);
  if (job.remaining > 0) return null;
  state.queue.shift();
  const ship = { id: state.nextId++, type: job.type, level: 1 };
  state.ships.push(ship);
  return ship;
}
