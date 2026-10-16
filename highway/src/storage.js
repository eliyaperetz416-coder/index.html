// Persistent save data (localStorage). All access is wrapped: private mode / blocked storage must never crash the game.
import { SAVE_KEY, SAVE_VERSION } from './config.js';

const defaults = () => ({
  v: SAVE_VERSION,
  coins: 0,
  selectedCar: 'hatch',
  ownedCars: ['hatch'],
  upgrades: {},           // carId -> { speed, handling, nitro }
  bestByCar: {},          // carId -> best score
  bestScore: 0,
  settings: { control: 'buttons', sound: true, quality: 'high', haptics: true, world: 'neoncity' },
  missions: { day: '', list: [] },
  stats: { runs: 0, closeCalls: 0, distance: 0, topSpeed: 0 },
  claimedEvents: {},      // `${eventId}@${startDate}` -> true (per occurrence)
  eventProgress: {},      // same key -> progress number
});

function merge(base, over) {
  if (over === null || typeof over !== 'object' || Array.isArray(base) !== Array.isArray(over)) return base;
  const out = Array.isArray(base) ? over.slice() : { ...base };
  if (Array.isArray(base)) return out;
  for (const k of Object.keys(over)) {
    out[k] = (base[k] !== null && typeof base[k] === 'object' && !Array.isArray(base[k])) ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

class Save {
  constructor() { this.data = defaults(); this.load(); }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.data = merge(defaults(), JSON.parse(raw));
    } catch (e) { this.data = defaults(); }
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } }
  reset() { this.data = defaults(); this.save(); }
}
export const save = new Save();
