// Save / load the game in the browser's localStorage.

import { createState } from './state.js';
import { TERM } from '../data/term.js';

const KEY = 'space-overlord-save-v2';

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
      return {
        ...fresh,
        ...saved,
        rare: { ...fresh.rare, ...saved.rare },
        reputation: { ...fresh.reputation, ...saved.reputation },
        war: { ...fresh.war, ...saved.war },
        stats: { ...fresh.stats, ...saved.stats },
        suit: { ...fresh.suit, ...saved.suit },
        // Saves from before terms existed get a full term from where they are now.
        termEnds: saved.termEnds ?? saved.time + TERM.length,
        runId: saved.runId ?? fresh.runId,
      };
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

// --- high scores: kept separately so they survive a new game ---

const SCORES_KEY = 'space-overlord-scores-v1';
const SCORES_KEPT = 10;

/** Best runs first: [{ runId, term, score, title, date }] */
export function loadScores() {
  try {
    const list = JSON.parse(localStorage.getItem(SCORES_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Add a finished run and return the updated table. */
export function addScore(entry) {
  const list = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, SCORES_KEPT);
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: the table just won't be remembered.
  }
  return list;
}
