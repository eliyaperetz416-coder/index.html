// Career progress: which tracks are open, medals, best times. Pure functions over the save.

import { CAREER, TRACK_BY_ID } from '../config/tracks.js';

export const MEDALS = ['gold', 'silver', 'bronze'];

export function trackRecord(save, id) {
  return save.tracks[id] ?? { best: null, done: 0, medal: null };
}

export function isUnlocked(save, track) {
  if (!track.requires) return true;
  return trackRecord(save, track.requires).done > 0;
}

/** Medal for a time: 'gold' | 'silver' | 'bronze' | null. */
export function medalFor(track, time) {
  const par = track.par ?? [];
  for (let i = 0; i < par.length; i++) if (time <= par[i]) return MEDALS[i];
  return null;
}

const rank = (m) => (m ? 3 - MEDALS.indexOf(m) : 0);

/** The track the big start button plays: the last one played if open, else the first open one not finished. */
export function currentTrack(save) {
  const last = TRACK_BY_ID[save.lastTrack];
  if (last && isUnlocked(save, last)) return last;
  return CAREER.find((t) => isUnlocked(save, t) && !trackRecord(save, t.id).done) ?? CAREER[0];
}

/** Next career track after `id` if it is open. */
export function nextTrack(save, id) {
  const i = CAREER.findIndex((t) => t.id === id);
  const next = CAREER[i + 1];
  return next && isUnlocked(save, next) ? next : null;
}

/**
 * Store a finished race. Returns what changed, for the result screen.
 * Mutates save.tracks.
 */
export function recordResult(save, track, time) {
  const before = CAREER.filter((t) => isUnlocked(save, t)).map((t) => t.id);
  const rec = { ...trackRecord(save, track.id) };
  const firstClear = rec.done === 0;
  const newBest = rec.best == null || time < rec.best;
  if (newBest) rec.best = time;
  const medal = medalFor(track, time);
  const betterMedal = rank(medal) > rank(rec.medal);
  if (betterMedal) rec.medal = medal;
  rec.done++;
  save.tracks[track.id] = rec;
  const unlocked = CAREER.filter((t) => isUnlocked(save, t) && !before.includes(t.id));
  return { firstClear, newBest, best: rec.best, medal, betterMedal, unlocked };
}
