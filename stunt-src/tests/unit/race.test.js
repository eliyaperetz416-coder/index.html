import { describe, it, expect } from 'vitest';
import { Race } from '../../src/game/race.js';
import { TRACKS } from '../../src/config/tracks.js';
import { CARS, effectiveStats } from '../../src/config/cars.js';

/** Drives a race headless with a simple driver: full throttle, steer back to the centre line. */
export function simulate(track, carDef = CARS[0], { maxTime = 200, steer = (car) => -car.x * 0.15 } = {}) {
  const race = new Race({ track, stats: effectiveStats(carDef) });
  const dt = 1 / 60;
  const log = { events: {}, maxAir: 0, minSpeedAfterStart: Infinity };
  let t = 0;
  while (race.state !== 'finished' && t < maxTime) {
    const car = race.car;
    race.update(dt, { throttle: 1, steer: Math.max(-1, Math.min(1, steer(car))), brake: 0 });
    for (const e of race.events) log.events[e.type] = (log.events[e.type] ?? 0) + 1;
    race.events.length = 0;
    if (car.mode === 'air') log.maxAir = Math.max(log.maxAir, car.airTime);
    if (!Number.isFinite(car.pos.x + car.pos.y + car.pos.z)) throw new Error(`NaN position at t=${t}`);
    t += dt;
  }
  return { race, log, t };
}

describe('Race (headless)', () => {
  it('drives the test track from start to finish', () => {
    const { race, log } = simulate(TRACKS[0]);
    expect(race.state).toBe('finished');
    expect(log.events.launch).toBeGreaterThanOrEqual(1); // the jump
    expect(log.events.land).toBeGreaterThanOrEqual(1);
    expect(log.events.respawn ?? 0).toBe(0); // jump assist clears the gap
    expect(log.events.crash ?? 0).toBe(0);
    expect(race.finishTime).toBeGreaterThan(15);
    expect(race.finishTime).toBeLessThan(90);
  });

  it('a slow car still clears the jump (assist) and the loop (min speed)', () => {
    const slow = { ...CARS[0], stats: { ...CARS[0].stats, topSpeed: 22, accel: 6 } };
    const { race, log } = simulate(TRACKS[0], slow, { maxTime: 400 });
    expect(race.state).toBe('finished');
    expect(log.events.respawn ?? 0).toBe(0);
  });

  it('a car steered off the road respawns and still finishes', () => {
    const track = {
      id: 'edge',
      pieces: [{ type: 'start' }, { type: 'straight', length: 200, walls: false }, { type: 'finish' }],
    };
    let pushed = false;
    const { race, log } = simulate(track, CARS[0], {
      steer: (car) => {
        if (car.s > 80 && !pushed) {
          if (car.mode === 'air') pushed = true;
          return 1;
        }
        return -car.x * 0.15;
      },
    });
    expect(log.events.respawn).toBe(1);
    expect(race.state).toBe('finished');
  });

  it('a hit slows the car down but the race goes on', () => {
    const race = new Race({ track: TRACKS[0], stats: effectiveStats(CARS[0]) });
    for (let i = 0; i < 600; i++) race.update(1 / 60, { throttle: 1, steer: 0, brake: 0 });
    const v = race.car.v;
    race.car.hit({ slow: 0.4, push: 3 });
    expect(race.car.v).toBeCloseTo(v * 0.4, 3);
    expect(race.state).toBe('racing');
  });
});
