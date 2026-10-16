// Upgrade paths. Every car has all four; costs scale with the car's tier (TIERS[].upgradeCost)
// and grow per level: cost(level) = base * growth^level * tierCost.

export const MAX_LEVEL = 10;

export const UPGRADES = [
  { id: 'speed', name: 'Top Speed', base: 120, growth: 1.42, effect: '+2.5% top speed', perLevel: 0.025 },
  { id: 'accel', name: 'Acceleration', base: 100, growth: 1.42, effect: '+5% acceleration', perLevel: 0.05 },
  { id: 'handling', name: 'Handling', base: 100, growth: 1.42, effect: '+0.03 handling', perLevel: 0.03 },
  { id: 'idle', name: 'Idle Earnings', base: 150, growth: 1.5, effect: 'coins per hour while you are away' },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// Idle earnings: coins/hour = sum over owned cars of level * tier.idlePerLevel.
// Offline time counts up to IDLE_CAP_HOURS.
export const IDLE_CAP_HOURS = 8;
export const IDLE_MIN_MINUTES = 2; // shorter absences are not worth a pop-up
