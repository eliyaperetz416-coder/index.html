// Save / load the game in the browser's localStorage.

import { createState } from './state.js';

const KEY = 'space-overlord-save-v1';

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private window): the game still works, it just won't remember.
  }
}

/** @param seed used only when there is no save and a new game starts */
export function load(seed) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.version === 1 && Array.isArray(saved.modules)) {
      // Start from a fresh state so saves from older versions get any fields added since.
      const fresh = createState(seed);
      return { ...fresh, ...saved, rare: { ...fresh.rare, ...saved.rare }, reputation: { ...fresh.reputation, ...saved.reputation }, war: { ...fresh.war, ...saved.war } };
    }
  } catch {
    // Broken save: start fresh.
  }
  return createState(seed);
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
