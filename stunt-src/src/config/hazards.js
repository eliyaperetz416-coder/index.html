// Hazards, boost pads and pickups: default settings per type, and reusable presets.
// Any value can be overridden where the item is placed on a track piece, and worlds can
// override them too (world.items). Distances in metres, times in seconds, angles in degrees.
//
// Hit fields: slow = fraction of speed kept, push = sideways knock (m/s), pop = upward knock,
// spin = tumble (rad/s). near = how close counts as a near miss (metres, or seconds for lasers).

export const HAZARDS = {
  boost: { length: 9, width: 5, power: 0.35, duration: 1.4 },
  coins: { count: 6, spacing: 4, pattern: 'line', height: 6, value: 1, amp: 3 },
  barrier: { width: 3.2, length: 1.2, height: 1.3, near: 1.2, slow: 0.55 },

  // Spinning blade standing in a slot, sliding across the road (sweep = metres each way).
  sawblade: { radius: 2.1, sweep: 4, period: 2.6, phase: 0, spin: 16, slow: 0.45, push: 7, near: 1.3 },

  // Ball on a chain swinging across the road under a gantry.
  wreckingBall: { radius: 1.9, chain: 11, pivotHeight: 14.5, swing: 58, period: 3.0, phase: 0, slow: 0.6, push: 12, pop: 9, spin: 7, near: 1.6 },

  // Column beside the road that topples across it when the car is `trigger` seconds away.
  // side: +1 stands on the right and falls to the left, -1 the other way.
  // cover: fraction of the road width it blocks once down (its length follows the road width).
  pillar: { side: 1, cover: 0.55, radius: 1.2, trigger: 1.7, fallTime: 0.9, slow: 0.4, push: 5, near: 1.5 },

  // Laser gate: the road is split into lanes whose beams switch on and off.
  // pattern: 'sync' (all lanes together), 'alternate' (odd/even), 'wave' (one after another).
  laser: { lanes: 3, period: 2.4, duty: 0.5, pattern: 'alternate', phase: 0, warn: 0.35, slow: 0.5, near: 0.35 },

  // Oil slick: almost no grip while on it (and a moment after).
  oil: { length: 16, width: 6, traction: 0.12, linger: 0.6 },
};

/**
 * Presets: groups of items placed together with one line, e.g.
 *   items: [{ preset: 'saw-slalom', at: 40 }]
 * Each entry's `at` is relative to the preset's `at`.
 */
export const PRESETS = {
  'saw-slalom': [
    { type: 'sawblade', at: 0, x: -3.5, sweep: 0 },
    { type: 'sawblade', at: 28, x: 3.5, sweep: 0 },
    { type: 'sawblade', at: 56, x: -3.5, sweep: 0 },
  ],
  'saw-sweepers': [
    { type: 'sawblade', at: 0, x: 0, sweep: 4.5, period: 2.4 },
    { type: 'sawblade', at: 35, x: 0, sweep: 4.5, period: 2.4, phase: 3.14 },
  ],
  'pendulum-pair': [
    { type: 'wreckingBall', at: 0 },
    { type: 'wreckingBall', at: 40, phase: 3.14 },
  ],
  'laser-gates': [
    { type: 'laser', at: 0, pattern: 'alternate' },
    { type: 'laser', at: 45, pattern: 'alternate', phase: 0.5 },
  ],
  'oil-chicane': [
    { type: 'oil', at: 0, x: -3.5 },
    { type: 'oil', at: 30, x: 3.5 },
  ],
  'pillar-run': [
    { type: 'pillar', at: 0, side: 1 },
    { type: 'pillar', at: 80, side: -1 },
  ],
  'coin-line': [{ type: 'coins', at: 0, count: 8, spacing: 4 }],
};
