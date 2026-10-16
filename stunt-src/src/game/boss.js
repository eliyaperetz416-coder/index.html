// Boss races: turn a track's `boss` config into a rival for Race. The rival's speed is set from
// the player's own car (times boss.power), so a boss can be beaten with any car by using nitro,
// boost pads and clean lines, and is never a pushover with a fast car.

import { effectiveStats } from './economy.js';

export function bossRivals(track, playerStats, random) {
  const b = track.boss;
  if (!b) return [];
  const own = effectiveStats(b.car);
  const power = b.power ?? 1;
  return [{
    name: b.name,
    def: b.car,
    glow: b.glow,
    skill: b.skill,
    aggression: b.aggression,
    rubber: b.rubber,
    random,
    stats: {
      ...own,
      topSpeed: playerStats.topSpeed * power,
      accel: playerStats.accel * power,
      steerSpeed: Math.max(own.steerSpeed, playerStats.steerSpeed),
    },
  }];
}
