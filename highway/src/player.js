// Player car: lane targeting with a spring-damper, speed ramp, visual tilt.
import * as THREE from 'three';
import { CFG } from './config.js';
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
    this.root.add(this.model);
    this.len = carDef.model.length; this.wid = carDef.model.width;
    this.reset();
  }

  reset() {
    this.lane = this.world.playerStartLane;
    this.targetX = laneX(this.world, this.lane);
    this.x = this.targetX; this.vx = 0;
    this.speed = CFG.startSpeedKmh * CFG.kmhToMs;
    this.time = 0;
    this.root.position.set(this.x, 0, 0);
    this.model.rotation.set(0, 0, 0);
  }

  changeLane(dir) {
    const n = this.world.lanes.length;
    this.lane = Math.max(0, Math.min(n - 1, this.lane + dir));
    this.targetX = laneX(this.world, this.lane);
  }

  get kmh() { return this.speed / CFG.kmhToMs; }

  /** target speed (km/h) the car is trying to reach this moment */
  targetKmh(boost) {
    const { topSpeed } = this.stats;
    const ramp = CFG.startSpeedKmh + (topSpeed - CFG.startSpeedKmh) * (1 - Math.exp(-this.time / 120));
    return ramp * (1 + boost);
  }

  update(dt, boost = 0) {
    this.time += dt;
    // longitudinal
    const target = this.targetKmh(boost) * CFG.kmhToMs;
    const accel = this.stats.accel * CFG.kmhToMs * (boost > 0 ? 2.6 : 1) * (1 - 0.55 * (this.speed / (this.stats.topSpeed * CFG.kmhToMs * (1 + boost))));
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
  }
}
