// A race session: one track, the player's car, the clock and the score. Pure simulation, no
// rendering: the view (raceView.js) reads its state and the events it emits.

import { TrackPath } from '../track/path.js';
import { Car } from '../physics/car.js';
import { PHYSICS, RACE } from '../config/game.js';
import { clamp } from '../core/math.js';

const pathCache = new Map();

/** Track paths are expensive to build and never change: build once per track. */
export function getPath(track) {
  let p = pathCache.get(track.id);
  if (!p) {
    p = new TrackPath(track);
    pathCache.set(track.id, p);
  }
  return p;
}

export class Race {
  /**
   * @param {{track: object, stats: object}} opts track config and effective car stats
   */
  constructor({ track, stats }) {
    this.track = track;
    this.path = getPath(track);
    this.events = [];
    this.emit = (type, data = {}) => this.events.push({ type, ...data });
    this.car = new Car(this.path, stats, (type, data) => this.onCarEvent(type, data));
    this.state = 'countdown';
    this.countdown = RACE.countdown;
    this.time = 0;
    this.finishTime = 0;
    this.after = 0; // seconds since the finish line
    this.score = { air: 0, flips: 0, crashes: 0, walls: 0 };
  }

  get progress() {
    const p = this.path;
    return clamp((this.car.trackS - p.startS) / (p.finishS - p.startS), 0, 1);
  }

  onCarEvent(type, data) {
    if (type === 'land' && data.airTime > 0.5) this.score.air += data.airTime;
    if (type === 'flip') this.score.flips += data.flips + data.rolls;
    if (type === 'crash' || type === 'respawn') this.score.crashes++;
    if (type === 'wall') this.score.walls++;
    this.emit(type, data);
  }

  /** Advance by dt seconds (split into fixed-size physics substeps). */
  update(dt, input) {
    const n = Math.max(1, Math.ceil(dt / PHYSICS.step - 1e-6));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.step(h, input);
  }

  step(dt, input) {
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown);
      if (now !== before && now > 0) this.emit('count', { n: now });
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.emit('go', { perfect: input.throttle > 0 });
      }
      this.car.throttle = input.throttle;
      return;
    }
    if (this.state === 'racing') {
      this.time += dt;
      this.car.step(dt, input);
      if (this.car.trackS >= this.path.finishS && this.car.mode === 'ground') this.finish();
      return;
    }
    // Finished: coast to a stop down the run-off.
    this.after += dt;
    const auto = { throttle: 0, steer: -this.car.x * 0.08, brake: this.car.v > 12 ? 0.35 : 0 };
    this.car.step(dt, auto);
  }

  finish() {
    this.state = 'finished';
    this.finishTime = this.time;
    this.emit('finish', { time: this.time });
  }

  /** Coin lines shown on the result screen. */
  tally() {
    const lines = [];
    lines.push({ label: 'Race reward', coins: this.track.reward ?? RACE.baseReward });
    if (this.score.air > 0) lines.push({ label: `Air time ${this.score.air.toFixed(1)}s`, coins: Math.round(this.score.air * 6) });
    if (this.score.flips > 0) lines.push({ label: `Flips x${this.score.flips}`, coins: this.score.flips * 25 });
    const total = lines.reduce((a, l) => a + l.coins, 0);
    return { lines, total };
  }
}
