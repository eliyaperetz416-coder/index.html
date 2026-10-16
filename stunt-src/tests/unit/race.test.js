import { describe, it, expect } from 'vitest';
import { Race } from '../../src/game/race.js';
import { TRACK_BY_ID } from '../../src/config/tracks.js';
import { CARS } from '../../src/config/cars.js';
import { effectiveStats } from '../../src/game/economy.js';

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
    const { race, log } = simulate(TRACK_BY_ID.test);
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
    const { race, log } = simulate(TRACK_BY_ID.test, slow, { maxTime: 400 });
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
    const track = { id: 'flat', pieces: [{ type: 'start' }, { type: 'straight', length: 600 }, { type: 'finish' }] };
    const race = new Race({ track, stats: effectiveStats(CARS[0]) });
    for (let i = 0; i < 600; i++) race.update(1 / 60, { throttle: 1, steer: 0, brake: 0 });
    expect(race.car.mode).toBe('ground');
    const v = race.car.v;
    race.car.hit({ slow: 0.4, push: 3 });
    expect(race.car.v).toBeCloseTo(v * 0.4, 3);
    expect(race.state).toBe('racing');
  });
});

describe('Track items and game feel', () => {
  const base = { id: 'items', world: 'neon' };
  const drive = (race, seconds, steer = 0, extra = {}) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      race.update(1 / 60, { throttle: 1, steer: typeof steer === 'function' ? steer(race.car) : steer, brake: 0, ...extra });
    }
  };

  it('a boost pad speeds the car past its top speed', () => {
    const track = { ...base, pieces: [{ type: 'start' }, { type: 'straight', length: 300, items: [{ type: 'boost', at: 200 }] }, { type: 'finish' }] };
    const race = new Race({ track, stats: effectiveStats(CARS[0]) });
    const pad = race.items.find((it) => it.type === 'boost');
    while (race.car.s < pad.s - 15) race.update(1 / 60, { throttle: 1, steer: 0, brake: 0 });
    const before = race.car.v;
    expect(race.score.boosts).toBe(0);
    drive(race, 1);
    expect(race.score.boosts).toBe(1);
    expect(race.car.v).toBeGreaterThan(before);
    expect(race.car.v).toBeGreaterThan(CARS[0].stats.topSpeed);
    expect(race.events.some((e) => e.type === 'boost')).toBe(true);
  });

  it('coins on the centre line are collected', () => {
    const track = { ...base, pieces: [{ type: 'start' }, { type: 'straight', length: 200, items: [{ type: 'coins', at: 40, count: 5 }] }, { type: 'finish' }] };
    const race = new Race({ track, stats: effectiveStats(CARS[0]) });
    drive(race, 10);
    expect(race.score.coins).toBe(5);
  });

  it('hitting a barrier slows the car; squeezing past one is a near miss', () => {
    const hitTrack = { ...base, pieces: [{ type: 'start' }, { type: 'straight', length: 300, items: [{ type: 'barrier', at: 150, x: 0 }] }, { type: 'finish' }] };
    const r1 = new Race({ track: hitTrack, stats: effectiveStats(CARS[0]) });
    let vBefore = 0;
    for (let t = 0; t < 12 && r1.score.hits === 0; t += 1 / 60) {
      vBefore = r1.car.v;
      r1.update(1 / 60, { throttle: 1, steer: 0, brake: 0 });
    }
    expect(r1.score.hits).toBe(1);
    expect(r1.car.v).toBeLessThan(vBefore * 0.7);
    expect(r1.state).toBe('racing');

    const missTrack = { ...base, pieces: [{ type: 'start' }, { type: 'straight', length: 300, items: [{ type: 'barrier', at: 150, x: -2.8 }] }, { type: 'finish' }] };
    const r2 = new Race({ track: missTrack, stats: effectiveStats(CARS[0]) });
    drive(r2, 12, (car) => (0.9 - car.x) * 0.5); // hold the car at x = 0.9: 0.2 m clear of the barrier
    expect(r2.score.hits).toBe(0);
    expect(r2.score.nearMiss).toBe(1);
  });

  it('nitro needs fuel, then boosts; hard steering at speed drifts and fills the tank', () => {
    const track = { ...base, pieces: [{ type: 'start' }, { type: 'straight', length: 1500, walls: true }, { type: 'finish' }] };
    const race = new Race({ track, stats: effectiveStats(CARS[0]) });
    drive(race, 3 + 6);
    race.nitro = 0.1;
    expect(race.fireNitro()).toBe(false);
    race.nitro = 1;
    const v = race.car.v;
    expect(race.fireNitro()).toBe(true);
    drive(race, 1);
    expect(race.car.v).toBeGreaterThan(v + 3);
    race.nitro = 0;
    let drifted = false;
    for (let t = 0; t < 2; t += 1 / 60) {
      race.update(1 / 60, { throttle: 1, steer: t < 1 ? 1 : -1, brake: 0 });
      drifted ||= race.car.drifting;
    }
    expect(drifted).toBe(true);
    expect(race.nitro).toBeGreaterThan(0.1);
  });
});
