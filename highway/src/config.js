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

// Scoring / feel tuning (kept here so balance changes don't touch game logic)
export const SCORE = {
  distancePerKmhSec: 0.25,   // points per (km/h * second), before multiplier
  closeCall: 120,
  tightCall: 260,
  comboWindow: 6,            // seconds without a close call before the combo drops
  comboStep: 0.15,           // multiplier gained per combo step (x car comboMult)
  comboMaxSteps: 40,
  lightHitSpeedLoss: 0.18,
  lightHitInvuln: 1.0,       // seconds
  lightHitMaxOverlap: 0.85,  // metres of lateral overlap that still counts as a graze
  minSpeedKmh: 95,
  crashTime: 1.1,
};
export const NITRO = {
  drainPerSec: 28,           // divided by the car's nitro stat (bigger tank/efficiency)
  rechargePerSec: 5,
  closeCallBonus: 9,
  unlockAt: 25,              // after the meter runs dry it stays locked until it refills to this
  boostPerStat: 0.16,        // speed boost fraction = this * nitro stat
};
