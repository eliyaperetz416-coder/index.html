// Daily missions. Every day three are picked from this pool (the same three for everyone on the
// same date). In `text`, {n} is the target and {s} an 's' when it is not 1. `stat` is what a race
// adds to (see src/game/missions.js); `n` and `reward` are [easy, hard] and the day's roll picks a
// value in between.

export const DAILY_COUNT = 3;
export const ALL_DONE_BONUS = 500;

export const MISSIONS = [
  { id: 'races', text: 'Finish {n} race{s}', stat: 'races', n: [3, 6], reward: [150, 280] },
  { id: 'near', text: 'Get {n} near misses', stat: 'nearMiss', n: [8, 18], reward: [200, 350] },
  { id: 'drift', text: 'Drift for {n} seconds', stat: 'drift', n: [8, 20], reward: [180, 320] },
  { id: 'air', text: 'Spend {n} seconds in the air', stat: 'air', n: [8, 16], reward: [180, 300] },
  { id: 'coins', text: 'Pick up {n} coins on the track', stat: 'coins', n: [60, 140], reward: [180, 320] },
  { id: 'nitro', text: 'Fire nitro {n} time{s}', stat: 'nitros', n: [4, 10], reward: [150, 260] },
  { id: 'flips', text: 'Land {n} flip{s} or roll{s}', stat: 'flips', n: [2, 5], reward: [200, 340] },
  { id: 'clean', text: 'Finish {n} race{s} without a hit', stat: 'clean', n: [1, 3], reward: [220, 400] },
  { id: 'gold', text: 'Win {n} gold medal{s}', stat: 'gold', n: [1, 2], reward: [250, 420] },
  { id: 'boost', text: 'Hit {n} boost pads', stat: 'boosts', n: [8, 16], reward: [150, 260] },
];
