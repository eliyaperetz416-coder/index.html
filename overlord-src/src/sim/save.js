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

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.version === 1 && Array.isArray(saved.modules)) return { ...createState(), ...saved };
  } catch {
    // Broken save: start fresh.
  }
  return createState();
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
