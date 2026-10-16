// A race session: one track, the player's car, track items, the clock and the score. Pure
// simulation, no rendering: the view (raceView.js) reads its state and the events it emits.

import { TrackPath } from '../track/path.js';
import { Car } from '../physics/car.js';
import { createItems } from '../hazards/index.js';
import { PHYSICS, RACE, NITRO, SCORE } from '../config/game.js';
import { WORLD_BY_ID } from '../config/worlds.js';
import { clamp } from '../core/math.js';

const pathCache = new Map();

/** Track paths are expensive to build and never change: build once per track. */
export function getPath(track) {
  let p = pathCache.get(track.id);
  if (!p || p.def !== track) {
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
    this.world = WORLD_BY_ID[track.world] ?? null;
    this.path = getPath(track);
    this.events = [];
    this.emit = (type, data = {}) => this.events.push({ type, ...data });
    this.car = new Car(this.path, stats, (type, data) => this.onCarEvent(type, data));
    this.items = createItems(track, this.path, this.world);
    this.state = 'countdown';
    this.countdown = RACE.countdown;
    this.time = 0;
    this.finishTime = 0;
    this.after = 0; // seconds since the finish line
    this.nitro = NITRO.start; // tank 0..1
    this.combo = 0;
    this.comboTimer = 0;
    this.score = { air: 0, flips: 0, crashes: 0, walls: 0, nearMiss: 0, nearMissPoints: 0, drift: 0, coins: 0, boosts: 0, hits: 0, nitros: 0, bestCombo: 0 };
  }

  get progress() {
    const p = this.path;
    return clamp((this.car.trackS - p.startS) / (p.finishS - p.startS), 0, 1);
  }

  addNitro(amount) {
    this.nitro = Math.min(1, this.nitro + amount);
  }

  onCarEvent(type, data) {
    const sc = this.score;
    if (type === 'land' && data.airTime > 0.5) {
      sc.air += data.airTime;
      this.addNitro(data.airTime * NITRO.perAirSecond);
    }
    if (type === 'flip') {
      sc.flips += data.flips + data.rolls;
      this.addNitro(NITRO.perFlip);
    }
    if (type === 'crash' || type === 'respawn') sc.crashes++;
    if (type === 'wall') sc.walls++;
    if (type === 'drift' && data.time > 0.4) sc.drift += data.time;
    this.emit(type, data);
  }

  // --- called by track items -------------------------------------------------------------

  boostPad(item) {
    this.car.boost(item.def.power, item.def.duration);
    this.score.boosts++;
    this.addNitro(NITRO.perPad);
    this.emit('boost', { pad: true });
  }

  collectCoin(coin, value = 1) {
    this.score.coins += value;
    this.emit('coin', { value });
  }

  /** A hazard hit the car. Costs speed, never ends the race. Returns false while invulnerable. */
  hitCar(source, hit) {
    const car = this.car;
    if (car.invuln > 0 || this.state !== 'racing') return false;
    car.hit(hit);
    car.invuln = RACE.hitImmunity;
    this.score.hits++;
    this.combo = 0;
    this.emit('hit', { source: source.type, ...hit });
    return true;
  }

  nearMiss(source) {
    if (this.state !== 'racing') return;
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = SCORE.comboWindow;
    const points = SCORE.nearMiss * this.combo;
    this.score.nearMiss++;
    this.score.nearMissPoints += points;
    this.score.bestCombo = Math.max(this.score.bestCombo, this.combo);
    this.addNitro(NITRO.perNearMiss);
    this.emit('nearMiss', { source: source.type, combo: this.combo, points });
  }

  fireNitro() {
    if (this.nitro < NITRO.minFire || this.state !== 'racing') return false;
    const k = this.car.stats.nitro ?? 0.5;
    const amount = this.nitro;
    this.nitro = 0;
    this.car.boost(NITRO.power + NITRO.powerPerStat * k, (NITRO.duration + NITRO.durationPerStat * k) * amount);
    this.score.nitros++;
    this.emit('nitro', { amount });
    return true;
  }

  // --- simulation ----------------------------------------------------------------------------

  /** Advance by dt seconds (split into fixed-size physics substeps). */
  update(dt, input) {
    const n = Math.max(1, Math.ceil(dt / PHYSICS.step - 1e-6));
    const h = dt / n;
    if (input.nitro) this.fireNitro();
    for (let i = 0; i < n; i++) this.step(h, input);
  }

  step(dt, input) {
    for (const it of this.items) it.update?.(dt, this.time);
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown);
      if (now !== before && now > 0) this.emit('count', { n: now });
      if (this.countdown <= 0) {
        this.state = 'racing';
        const perfect = input.throttle > 0;
        if (perfect) this.car.boost(RACE.startBoost, 1.5, false);
        this.emit('go', { perfect });
      }
      this.car.throttle = input.throttle;
      return;
    }
    if (this.state === 'racing') {
      this.time += dt;
      this.car.step(dt, input);
      this.collide(dt);
      if (this.car.drifting) this.addNitro(NITRO.perDriftSecond * dt);
      this.addNitro(NITRO.passive * dt);
      if (this.comboTimer > 0) this.comboTimer -= dt;
      if (this.car.trackS >= this.path.finishS && this.car.mode === 'ground') this.finish();
      return;
    }
    // Finished: coast to a stop down the run-off.
    this.after += dt;
    const auto = { throttle: 0, steer: -this.car.x * 0.08, brake: this.car.v > 12 ? 0.35 : 0 };
    this.car.step(dt, auto);
  }

  collide(dt) {
    const s = this.car.trackS;
    // Items are sorted by s; scan the ones whose reach covers the car.
    for (const it of this.items) {
      if (it.s - it.reach > s + 4) break;
      if (it.s + it.reach + 6 < s) continue;
      it.collide?.(this.car, this, dt);
    }
  }

  finish() {
    this.state = 'finished';
    this.finishTime = this.time;
    this.car.endDrift();
    this.emit('finish', { time: this.time });
  }

  /** Coin lines shown on the result screen. */
  tally() {
    const sc = this.score;
    const lines = [];
    lines.push({ label: 'Race reward', coins: this.track.reward ?? RACE.baseReward });
    if (sc.coins > 0) lines.push({ label: `Coins picked up x${sc.coins}`, coins: sc.coins * SCORE.coin });
    if (sc.nearMiss > 0) lines.push({ label: `Near misses x${sc.nearMiss}`, coins: sc.nearMissPoints });
    if (sc.air > 0) lines.push({ label: `Air time ${sc.air.toFixed(1)}s`, coins: Math.round(sc.air * SCORE.perAirSecond) });
    if (sc.drift > 0) lines.push({ label: `Drift ${sc.drift.toFixed(1)}s`, coins: Math.round(sc.drift * SCORE.perDriftSecond) });
    if (sc.flips > 0) lines.push({ label: `Flips x${sc.flips}`, coins: sc.flips * SCORE.flip });
    const total = lines.reduce((a, l) => a + l.coins, 0);
    return { lines, total };
  }
}
