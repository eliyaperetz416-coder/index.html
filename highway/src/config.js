// Global constants. Everything content-like (cars, worlds, events...) lives in src/data/.
export const GAME_NAME = 'NEON LANES'; // placeholder - change it here (then run tools/sync-name.mjs)
export const GAME_TAGLINE = 'Night highway. No brakes.';
export const SAVE_KEY = 'neonlanes.save.v1';
export const SAVE_VERSION = 1;

export const CFG = {
  laneWidth: 3.4,
  roadShoulder: 1.6,
  startSpeedKmh: 110,
  spawnDistance: 330,        // metres ahead where traffic appears
  despawnBehind: 24,         // metres behind the player before traffic is recycled
  trafficPoolSize: 40,
  closeCallX: 3.7,           // |dx| below this while passing = close call
  tightCallX: 2.75,          // |dx| below this = tight call (double bonus)
  kmhToMs: 1 / 3.6,
};
