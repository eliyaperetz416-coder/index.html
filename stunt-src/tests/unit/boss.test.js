import { describe, it, expect } from 'vitest';
import { Race } from '../../src/game/race.js';
import { Driver } from '../../src/game/ai.js';
import { bossRivals } from '../../src/game/boss.js';
import { effectiveStats } from '../../src/game/economy.js';
import { TRACK_BY_ID } from '../../src/config/tracks.js';
import { CARS } from '../../src/config/cars.js';
import { rng } from '../../src/core/math.js';

function bossRace(trackId, { playerSkill = 1, nitro = true, seed = 3 } = {}) {
  const track = TRACK_BY_ID[trackId];
  const stats = effectiveStats(CARS[0]);
  const race = new Race({ track, stats, rivals: bossRivals(track, stats, rng(seed)) });
  const driver = new Driver({ skill: playerSkill, random: rng(seed + 1) });
  const count = {};
  for (let t = 0; t < 200 && !(race.state === 'finished' && race.rivals.every((r) => r.finished)); t += 1 / 60) {
    const input = { ...driver.update(1 / 60, race, race.car) };
    if (!nitro) input.nitro = false;
    race.update(1 / 60, input);
    for (const e of race.events) count[e.type] = (count[e.type] ?? 0) + 1;
    race.events.length = 0;
  }
  return { race, count };
}

describe('boss races', () => {
  for (const id of ['neon-boss', 'desert-boss']) {
    it(`${id}: a sharp driver using nitro beats the rival, and it is a close race`, () => {
      const { race } = bossRace(id);
      const r = race.rivals[0];
      expect(race.state).toBe('finished');
      expect(r.finished).toBe(true);
      expect(race.won).toBe(true);
      expect(r.finishTime - race.finishTime).toBeLessThan(5);
    });
  }

  it('the desert boss beats a sloppy driver who never uses nitro', () => {
    let losses = 0;
    for (let seed = 1; seed <= 4; seed++) if (!bossRace('desert-boss', { playerSkill: 0.3, nitro: false, seed }).race.won) losses++;
    expect(losses).toBeGreaterThan(0);
  });

  it('the rival rams a car that sits next to it', () => {
    const track = { id: 'ram', pieces: [{ type: 'start', width: 16 }, { type: 'straight', length: 900, width: 16 }, { type: 'finish' }] };
    const stats = effectiveStats(CARS[0]);
    const boss = { ...TRACK_BY_ID['neon-boss'].boss, aggression: 2 };
    const race = new Race({ track, stats, rivals: bossRivals({ boss }, stats, rng(1)) });
    let rams = 0;
    for (let t = 0; t < 20 && race.state !== 'finished'; t += 1 / 60) {
      race.update(1 / 60, { throttle: 1, steer: (-3 - race.car.x) * 0.3, brake: 0 });
      rams += race.events.filter((e) => e.type === 'rammed').length;
      race.events.length = 0;
    }
    expect(rams).toBeGreaterThan(0);
  });
});
