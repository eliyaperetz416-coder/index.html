// Global game constants. GAME_NAME is a placeholder: change it here and the title, the
// home-screen name (manifest) and every screen pick it up. Keep this file free of imports:
// vite.config.js reads it too.

export const GAME_NAME = 'Loop Riot';
export const GAME_TAGLINE = 'Stunt tracks. One finger.';

export const THEME_COLOR = '#0b0420';
export const BACKGROUND_COLOR = '#0b0420';

// localStorage key. Not derived from GAME_NAME so renaming the game keeps saves.
export const SAVE_KEY = 'stunt-racer-save';
export const SAVE_VERSION = 1;

// Service-worker cache names start with this, so other apps on the same origin keep theirs.
export const CACHE_PREFIX = 'stunt-';

// Arcade physics tuning (metres, seconds). Per-car numbers live in config/cars.js.
export const PHYSICS = {
  step: 1 / 120, // max physics substep
  gravity: 18,
  airGravityScale: 0.78, // < 1 = cars glide
  slopeGravityScale: 0.7, // how much hills speed you up or slow you down
  loopGravityScale: 0.3,
  loopMinSpeed: 20, // loops never stall
  brakeDecel: 26,
  coastDrag: 0.05, // per second, fraction of speed
  overspeedDecay: 0.8, // per second, above top speed
  centrifugal: 0.35,
  lateralGravity: 0.6,
  wallRestitution: 0.45,
  wallSpeedLoss: 0.05,
  carHalfWidth: 0.95,
  carHalfLength: 2.0,
  launchThreshold: 2.5, // m/s^2 of "negative grip" before a crest throws the car into the air
  airDrag: 0.03,
  airControl: 9,
  crashUpDot: 0.3, // landing with car-up . track-up below this is a crash
  crashSpeedFactor: 0.55,
  hardLandingSpeed: 9,
  fallDepth: 35, // metres below the track before we respawn
  maxAirTime: 7,
  respawnSpeedFactor: 0.55,
  respawnMinSpeed: 20,
  jumpMargin: 6, // jump assist lands at least this far past the gap
};

export const RACE = {
  countdown: 3, // seconds of 3-2-1
  finishCoast: 4, // seconds of auto-drive after the line before the result screen
  baseReward: 100,
};

export const CAMERA = {
  distance: 7.2,
  height: 3.1,
  lookAhead: 7,
  lookHeight: 1.1,
  fovPortrait: 82,
  fovLandscape: 62,
  posDamping: 9,
  upDamping: 5,
};

// Graphics presets. 'auto' picks medium on phones and high on desktops.
export const QUALITY = {
  low: { pixelRatio: 1, antialias: false, bloom: false, standardMaterials: false, scenery: 0.45, fogScale: 0.75, particles: 0.5 },
  medium: { pixelRatio: 1.5, antialias: false, bloom: false, standardMaterials: true, scenery: 0.75, fogScale: 1, particles: 0.8 },
  high: { pixelRatio: 2, antialias: true, bloom: true, standardMaterials: true, scenery: 1, fogScale: 1.15, particles: 1 },
};
