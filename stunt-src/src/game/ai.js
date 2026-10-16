// AI driver: looks ahead along the track, asks every item how dangerous each lateral position
// will be when the car gets there (item.danger(x, time)), and steers to the safest line.
// Used by rival bosses and by the tests that check every track is drivable.

import { clamp } from '../core/math.js';
import { PHYSICS } from '../config/game.js';

export class Driver {
  /**
   * @param {object} o
   * @param {number} o.skill 0..1: reaction and how far it looks ahead
   * @param {number} o.lookAhead metres
   * @param {() => number} o.random random source (deterministic in tests)
   */
  constructor({ skill = 1, lookAhead = 70, random = Math.random } = {}) {
    this.skill = skill;
    this.lookAhead = lookAhead * (0.5 + skill * 0.5);
    this.random = random;
    this.target = 0;
    this.replan = 0;
    this.out = { throttle: 1, steer: 0, brake: 0, nitro: false };
    this.preferX = null; // set by bosses to chase the player
    this.preferWeight = 0.25;
  }

  /** Cost of being at lateral position x through the items ahead (at `speedScale` x speed). */
  cost(race, car, x, speedScale = 1) {
    const s0 = car.trackS;
    const v = Math.max(12, car.speed * speedScale);
    let c = 0;
    for (const it of race.items) {
      if (!it.danger) continue;
      const d = it.s - s0;
      if (d < -2 || d > this.lookAhead) continue; // not sorted strictly: some hazards move
      const t = race.time + Math.max(0, d) / v;
      const w = 1 / (1 + Math.max(0, d) / 25); // nearer matters more
      c += it.danger(x, t) * w * 10;
    }
    // Other cars just ahead are obstacles too (unless we are the one trying to ram).
    if (this.preferX == null) {
      for (const other of this.others(race, car)) {
        const d = other.trackS - s0;
        if (d < -1 || d > 28) continue;
        if (Math.abs(x - other.proj.x) < 2.6) c += 4 / (1 + d / 10);
      }
    }
    return c;
  }

  others(race, car) {
    const list = race.rivals?.map((r) => r.car) ?? [];
    if (race.car !== car) list.push(race.car);
    return list.filter((c) => c !== car);
  }

  /** Best lateral target at a given speed scale: [x, cost]. */
  plan(race, car, speedScale) {
    const hw = car.path.widthAt(car.trackS) / 2 - PHYSICS.carHalfWidth - 0.3;
    let best = this.target;
    let bestCost = Infinity;
    for (let x = -hw; x <= hw + 1e-6; x += 0.75) {
      let c = this.cost(race, car, x, speedScale);
      c += Math.abs(x - car.proj.x) * 0.08 + Math.abs(x) * 0.02;
      if (this.preferX != null) c += Math.abs(x - this.preferX) * this.preferWeight;
      if (c < bestCost) {
        bestCost = c;
        best = x;
      }
    }
    return [clamp(best, -hw, hw), bestCost];
  }

  update(dt, race, car) {
    const o = this.out;
    this.replan -= dt;
    if (this.replan <= 0) {
      this.replan = (this.preferX != null ? 0.06 : 0.12) + (1 - this.skill) * 0.25;
      let [x, c] = this.plan(race, car, 1);
      this.braking = false;
      // Every line is blocked at the time we'd get there (lasers, swinging balls): try arriving later.
      if (c > 2.5 && this.skill > 0.5) {
        const [x2, c2] = this.plan(race, car, 0.75);
        if (c2 < c * 0.5) {
          [x, c] = [x2, c2];
          this.braking = true;
        }
      }
      this.target = x + (this.random() - 0.5) * (1 - this.skill) * 2;
    }
    const vx = car.mode === 'ground' ? car.vx : 0;
    o.steer = clamp((this.target - car.proj.x) * 0.55 - vx * 0.12, -1, 1);
    o.throttle = this.braking ? 0 : 1;
    o.brake = this.braking ? 0.5 : 0;
    o.nitro = race.nitro >= 1 && this.cost(race, car, car.proj.x) < 0.5;
    return o;
  }
}
