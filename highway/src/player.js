// Player car: lane targeting with a spring-damper, speed ramp, nitro, hit reactions.
import * as THREE from 'three';
import { CFG, SCORE, NITRO } from './config.js';
import { models } from './models.js';
import { laneX } from './world.js';

export class Player {
  constructor(scene, carDef, stats, worldDef) {
    this.scene = scene; this.world = worldDef;
    this.root = new THREE.Group(); scene.add(this.root);
    this.setCar(carDef, stats);
  }

  setCar(carDef, stats) {
    if (this.model) this.root.remove(this.model);
    this.car = carDef; this.stats = stats;
    this.model = models.createVehicle(carDef.model);
    models.setWet(this.model, this.world.wet);
    this.root.add(this.model);
    this.len = carDef.model.length; this.wid = carDef.model.width;
    this.reset();
  }

  setWorld(worldDef) { this.world = worldDef; models.setWet(this.model, worldDef.wet); this.reset(); }

  reset() {
    this.lane = this.world.playerStartLane;
    this.targetX = laneX(this.world, this.lane);
    this.x = this.targetX; this.vx = 0;
    this.speed = CFG.startSpeedKmh * CFG.kmhToMs;
    this.time = 0;
    this.nitro = { meter: 100, active: false, locked: false };
    this.boost = 0;            // current boost fraction (0..maxBoost)
    this.invuln = 0;
    this.crashed = false; this.spin = 0;
    this.root.position.set(this.x, 0, 0);
    this.model.rotation.set(0, 0, 0); this.model.position.set(0, 0, 0);
  }

  changeLane(dir) {
    if (this.crashed) return;
    const n = this.world.lanes.length;
    this.lane = Math.max(0, Math.min(n - 1, this.lane + dir));
    this.targetX = laneX(this.world, this.lane);
  }

  get kmh() { return this.speed / CFG.kmhToMs; }
  get maxBoost() { return NITRO.boostPerStat * this.stats.nitro; }
  get boostFrac() { return this.boost / this.maxBoost; }

  /** target speed (km/h) before boost: ramps up gradually towards the car's top speed */
  targetKmh() {
    const { topSpeed } = this.stats;
    return CFG.startSpeedKmh + (topSpeed - CFG.startSpeedKmh) * (1 - Math.exp(-this.time / 120));
  }

  addNitro(v) { this.nitro.meter = Math.min(100, this.nitro.meter + v); if (this.nitro.locked && this.nitro.meter >= NITRO.unlockAt) this.nitro.locked = false; }

  hitLight(dir) {
    this.speed = Math.max(SCORE.minSpeedKmh * CFG.kmhToMs, this.speed * (1 - SCORE.lightHitSpeedLoss));
    this.vx += dir * 7; this.invuln = SCORE.lightHitInvuln;
  }

  crash() { this.crashed = true; this.spin = (Math.random() < 0.5 ? -1 : 1) * 7; this.nitro.active = false; }

  update(dt, wantNitro) {
    const n = this.nitro;
    if (this.crashed) {
      this.speed = Math.max(0, this.speed - 55 * dt); this.boost = 0;
      this.model.rotation.y += this.spin * dt * Math.min(1, this.speed / 8 + 0.2);
      this.model.rotation.z = Math.min(0.5, this.model.rotation.z + dt * 1.5);
      this.x += this.vx * dt; this.vx *= 0.96; this.root.position.x = this.x; return;
    }
    this.time += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    // nitro meter
    n.active = wantNitro && !n.locked && n.meter > 0;
    if (n.active) {
      n.meter = Math.max(0, n.meter - (NITRO.drainPerSec / this.stats.nitro) * dt);
      if (n.meter <= 0) { n.locked = true; n.active = false; }
    } else {
      n.meter = Math.min(100, n.meter + NITRO.rechargePerSec * dt);
      if (n.locked && n.meter >= NITRO.unlockAt) n.locked = false;
    }
    const boostTarget = n.active ? this.maxBoost : 0;
    this.boost += (boostTarget - this.boost) * Math.min(1, dt * (boostTarget > this.boost ? 5 : 3));
    // longitudinal
    const top = this.stats.topSpeed * CFG.kmhToMs * (1 + this.boost);
    const target = this.targetKmh() * CFG.kmhToMs * (1 + this.boost);
    const accel = this.stats.accel * CFG.kmhToMs * (n.active ? 2.6 : 1) * (1 - 0.55 * Math.min(1, this.speed / top));
    if (this.speed < target) this.speed = Math.min(target, this.speed + accel * dt);
    else this.speed = Math.max(target, this.speed - 14 * dt);
    // lateral spring-damper (substepped for stability at low fps)
    const h = this.stats.handling;
    const w = 6 + 10 * h * (this.car.weight ? 1 / this.car.weight : 1);
    const zeta = this.car.twitchy ? 0.38 : 0.92;
    const steps = Math.ceil(dt / 0.008);
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      const acc = w * w * (this.targetX - this.x) - 2 * zeta * w * this.vx;
      this.vx += acc * sdt; this.x += this.vx * sdt;
    }
    const lim = (this.world.lanes.length * CFG.laneWidth) / 2 + CFG.roadShoulder - this.wid / 2 - 0.1;
    if (this.x > lim) { this.x = lim; this.vx = Math.min(0, this.vx); }
    if (this.x < -lim) { this.x = -lim; this.vx = Math.max(0, this.vx); }
    this.root.position.x = this.x;
    this.model.rotation.y = THREE.MathUtils.clamp(-this.vx * 0.045, -0.35, 0.35);
    this.model.rotation.z = THREE.MathUtils.clamp(-this.vx * 0.012, -0.12, 0.12);
    // blink while invulnerable
    this.model.visible = this.invuln <= 0 || Math.floor(this.invuln * 14) % 2 === 0;
    this.model.position.y = 0;
  }
}
