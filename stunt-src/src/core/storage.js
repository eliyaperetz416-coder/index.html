// Save game in localStorage: coins, cars, upgrades, cosmetics, progress and settings.
// load() merges the stored save over the defaults, so new fields appear in old saves.

import { SAVE_KEY, SAVE_VERSION } from '../config/game.js';

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    coins: 0,
    selectedCar: 'pebble',
    cars: { pebble: { owned: true } },
    cosmetics: { paint: [], rim: [], glow: [] },
    tracks: {},
    idle: { last: Date.now() },
    missions: null,
    settings: { quality: 'auto' },
    stats: { races: 0 },
  };
}

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep merge: values from `saved` win, missing keys come from `defaults`. */
export function merge(defaults, saved) {
  if (!isObject(saved)) return defaults;
  const out = { ...defaults };
  for (const [k, v] of Object.entries(saved)) out[k] = isObject(v) && isObject(defaults[k]) ? merge(defaults[k], v) : v;
  return out;
}

export class Storage {
  constructor(backend = globalThis.localStorage) {
    this.backend = backend;
    this.data = defaultSave();
    this.timer = null;
  }

  load() {
    try {
      const raw = this.backend?.getItem(SAVE_KEY);
      this.data = raw ? merge(defaultSave(), JSON.parse(raw)) : defaultSave();
    } catch (e) {
      console.warn('save unreadable, starting fresh', e);
      this.data = defaultSave();
    }
    return this.data;
  }

  /** Write soon (batches many changes in one write). */
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    clearTimeout(this.timer);
    try {
      this.backend?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('could not save', e);
    }
  }

  reset() {
    this.data = defaultSave();
    this.flush();
    return this.data;
  }
}

export const storage = new Storage();
