// A race session: one track, the player's car, track items, the clock and the score. Pure
// simulation, no rendering: the view (raceView.js) reads its state and the events it emits.

import { TrackPath } from '../track/path.js';
import { Car } from '../physics/car.js';
import { createItems } from '../hazards/index.js';
import { PHYSICS, RACE, NITRO, SCORE } from '../config/game.js';
import { WORLD_BY_ID } from '../config/worlds.js';
import { clamp } from '../core/math.js';
import { Driver } from './ai.js';

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
  constructor({ track, stats, rivals = [] }) {
    this.track = track;
    this.world = WORLD_BY_ID[track.world] ?? null;
    this.path = getPath(track);
    this.events = [];
    this.emit = (type, data = {}) => this.events.push({ type, ...data });
    this.car = new Car(this.path, stats, (type, data) => this.onCarEvent(type, data));
    // Rivals (boss races): an AI car each. They dodge hazards but are not hurt by them.
    this.rivals = rivals.map((r, i) => {
      const car = new Car(this.path, { ...r.stats }, () => {});
      car.reset(this.path.startS, 3.2, 0);
      return { ...r, index: i, car, base: { ...r.stats }, driver: new Driver({ skill: r.skill ?? 0.9, random: r.random }), finished: false, finishTime: 0 };
    });
    if (this.rivals.length) this.car.reset(this.path.startS, -3.2, 0);
    this.items = createItems(track, this.path, this.world);
    this.state = 'countdown';
    this.countdown = RACE.countdown;
    this.time = 0; // race clock, stops at the player's finish
    this.clock = 0; // keeps running after the finish (rivals still racing)
    this.finishTime = 0;
    this.after = 0; // seconds since the finish line
    this.nitro = NITRO.start; // tank 0..1
    this.combo = 0;
    this.comboTimer = 0;
    this.score = { air: 0, flips: 0, crashes: 0, walls: 0, nearMiss: 0, nearMissPoints: 0, drift: 0, coins: 0, boosts: 0, hits: 0, nitros: 0, bestCombo: 0 };
  }

  get progress() {
    return this.progressOf(this.car);
  }

  progressOf(car) {
    const p = this.path;
    return clamp((car.trackS - p.startS) / (p.finishS - p.startS), 0, 1);
  }

  /** 1 = leading. */
  get place() {
    const s = this.state === 'finished' ? Infinity : this.car.trackS;
    return 1 + this.rivals.filter((r) => (r.finished && (this.state !== 'finished' || r.finishTime < this.finishTime)) || (!r.finished && r.car.trackS > s)).length;
  }

  /** Boss race: did the player beat every rival? */
  get won() {
    return this.state === 'finished' && this.rivals.every((r) => !r.finished || r.finishTime > this.finishTime);
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
    if (car.invuln > 0 || this.state === 'countdown') return false;
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
        for (const r of this.rivals) r.car.boost(RACE.startBoost, 1.5, false);
        this.emit('go', { perfect });
      }
      this.car.throttle = input.throttle;
      return;
    }
    if (this.state !== 'countdown') this.clock += dt;
    if (this.state === 'racing') {
      this.time += dt;
      this.car.step(dt, input);
      this.collide(dt);
      this.stepRivals(dt);
      if (this.car.drifting) this.addNitro(NITRO.perDriftSecond * dt);
      this.addNitro(NITRO.passive * dt);
      if (this.comboTimer > 0) this.comboTimer -= dt;
      if (this.car.trackS >= this.path.finishS && this.car.mode === 'ground') this.finish();
      return;
    }
    // Finished: coast to a stop down the run-off. Rivals keep racing to the line.
    this.after += dt;
    const auto = { throttle: 0, steer: -this.car.x * 0.08, brake: this.car.v > 12 ? 0.35 : 0 };
    this.car.step(dt, auto);
    this.stepRivals(dt);
  }

  stepRivals(dt) {
    const me = this.car;
    for (const r of this.rivals) {
      const car = r.car;
      if (r.finished) {
        car.step(dt, { throttle: 0, steer: -car.x * 0.08, brake: car.v > 12 ? 0.35 : 0 });
        continue;
      }
      // Rubber band, only when the race is lopsided: ease off far ahead, catch up from far behind
      // (not in the last fifth, so a lead you earn holds). Close behind: a small burst to come
      // alongside and ram.
      const gap = car.trackS - me.trackS;
      const rb = r.rubber ?? { ahead: 0.93, behind: 1.12 };
      const prog = this.progressOf(car);
      let k = 1;
      if (r.cooldown > 0) {
        r.cooldown -= dt;
        k = 0.96; // backs off for a moment after a ram
      } else if (gap > 35) k = rb.ahead;
      else if (gap < -25 && prog < 0.8) k = rb.behind;
      else if (gap < 0 && gap > -15 && prog < 0.9) k = 1.03;
      r.k = (r.k ?? 1) + (k - (r.k ?? 1)) * Math.min(1, dt * 1.5);
      car.stats.topSpeed = r.base.topSpeed * r.k;
      car.stats.accel = r.base.accel * Math.max(1, r.k);
      // Ram: when the player is close, steer into them (hazards still come first).
      const close = this.state === 'racing' && !(r.cooldown > 0) && gap > -15 && gap < 22 && me.mode === 'ground';
      r.driver.preferX = close ? me.x : null;
      r.driver.preferWeight = (r.aggression ?? 1) * 1.6;
      const input = r.driver.update(dt, this, car);
      car.step(dt, input);
      this.contact(r, dt);
      if (car.trackS >= this.path.finishS && car.mode === 'ground') {
        r.finished = true;
        r.finishTime = this.clock;
        this.emit('rivalFinish', { name: r.name, time: this.clock, first: this.state !== 'finished' });
      }
    }
  }

  /**
   * Car-to-car contact in track coordinates. Boxes are separated along the axis that overlaps
   * least: side by side = a shove (the one who steered in did the ramming), nose to tail = the
   * car behind bounces off and the one in front gets nudged.
   */
  contact(r, dt) {
    if (r.bumped > 0) r.bumped -= dt;
    const a = this.car;
    const b = r.car;
    if (a.mode !== 'ground' || b.mode !== 'ground') return;
    const ds = b.s - a.s;
    const dx = b.x - a.x;
    const W = 1.9;
    const L = 4.0;
    const ps = L - Math.abs(ds);
    const px = W - Math.abs(dx);
    if (ps <= 0 || px <= 0) return;
    const ma = a.stats.mass ?? 1;
    const mb = b.stats.mass ?? 1;
    const wa = mb / (ma + mb);
    const wb = ma / (ma + mb);
    if (px < ps) {
      const side = Math.sign(dx) || 1;
      a.x -= side * px * wa;
      b.x += side * px * wb;
      const rel = (b.vx - a.vx) * side; // < 0: closing sideways
      if (rel < -0.5) {
        const rivalRammed = -b.vx * side > a.vx * side;
        const j = -rel * 1.8;
        a.vx -= side * j * wa;
        b.vx += side * j * wb;
        if (rivalRammed) {
          // Mostly a shove towards the wall or a hazard; the speed loss is small.
          if (this.hitCar({ type: 'rival' }, { slow: 0.93, push: -side * 6 * (mb / ma) })) {
            r.cooldown = 2.5;
            this.emit('rammed', { name: r.name });
          }
        } else if (!(r.bumped > 0)) {
          b.v *= 0.88;
          r.bumped = 1;
          this.emit('ramRival', { name: r.name });
        }
      }
    } else {
      const sign = Math.sign(ds) || 1; // +1: rival in front
      a.s -= sign * ps * wa;
      b.s += sign * ps * wb;
      const back = sign > 0 ? a : b;
      const front = sign > 0 ? b : a;
      const dv = back.v - front.v;
      if (dv > 0) {
        back.v -= dv * 0.7;
        front.v += dv * 0.25;
        if (!(r.bumped > 0)) {
          r.bumped = 0.5;
          this.emit(back === a ? 'bumped' : 'ramRival', { name: r.name });
        }
      }
    }
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
