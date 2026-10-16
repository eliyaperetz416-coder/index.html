import { describe, it, expect } from 'vitest';
import { Race } from '../../src/game/race.js';
import { Driver } from '../../src/game/ai.js';
import { CAREER } from '../../src/config/tracks.js';
import { CARS } from '../../src/config/cars.js';
import { effectiveStats } from '../../src/game/economy.js';
import { rng } from '../../src/core/math.js';
import { STEP, F_SOLID } from '../../src/track/path.js';

/** Races a track with the AI driver. */
export function aiRace(track, carDef = CARS[0], { skill = 1, seed = 1, maxTime = 200 } = {}) {
  const race = new Race({ track, stats: effectiveStats(carDef) });
  const driver = new Driver({ skill, random: rng(seed) });
  const dt = 1 / 60;
  const count = {};
  let t = 0;
  while (race.state !== 'finished' && t < maxTime) {
    race.update(dt, driver.update(dt, race, race.car));
    for (const e of race.events) count[e.type] = (count[e.type] ?? 0) + 1;
    race.events.length = 0;
    t += dt;
  }
  return { race, count };
}

describe('Career tracks', () => {
  for (const track of CAREER) {
    it(`${track.name}: road never runs into itself`, () => {
      const race = new Race({ track, stats: effectiveStats(CARS[0]) });
      const p = race.path;
      const pts = [];
      for (let i = 0; i < p.count; i += Math.round(4 / STEP)) if (p.flags[i] & F_SOLID) pts.push([i * STEP, p.P[i * 3], p.P[i * 3 + 1], p.P[i * 3 + 2]]);
      let closest = Infinity;
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          if (pts[b][0] - pts[a][0] < 90) continue;
          const d = Math.hypot(pts[a][1] - pts[b][1], pts[a][2] - pts[b][2], pts[a][3] - pts[b][3]);
          closest = Math.min(closest, d);
        }
      }
      expect(closest).toBeGreaterThan(16);
    });

    it(`${track.name}: the AI finishes in 40-90 s without falling off`, () => {
      const { race, count } = aiRace(track);
      console.log(`${track.id}: ${race.finishTime.toFixed(1)}s hits=${race.score.hits} near=${race.score.nearMiss} coins=${race.score.coins} crash=${count.crash ?? 0} respawn=${count.respawn ?? 0} air=${race.score.air.toFixed(1)}`);
      expect(race.state).toBe('finished');
      expect(count.respawn ?? 0).toBe(0);
      expect(race.finishTime).toBeGreaterThan(40);
      expect(race.finishTime).toBeLessThan(90);
      // A good line through the hazards exists.
      expect(race.score.hits).toBeLessThanOrEqual(2);
    });
  }

  it('a sloppy driver still finishes the hardest track inside 90 s', () => {
    const { race } = aiRace(CAREER[CAREER.length - 1], CARS[0], { skill: 0.4, seed: 7 });
    console.log(`sloppy: ${race.finishTime.toFixed(1)}s hits=${race.score.hits}`);
    expect(race.state).toBe('finished');
    expect(race.finishTime).toBeLessThan(90);
  });

  it('difficulty rises through each world', () => {
    for (const w of new Set(CAREER.map((t) => t.world))) {
      const d = CAREER.filter((t) => t.world === w && !t.boss).map((t) => t.difficulty);
      expect(d).toEqual([...d].sort((a, b) => a - b));
    }
  });
});
