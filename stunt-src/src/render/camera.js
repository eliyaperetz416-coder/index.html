// Chase camera. On the road it rides the track a few metres behind the car (so it follows loops,
// drops and banked turns without lag). In the air it switches to a free chase behind the flight
// path, and blends back smoothly after landing. Supports shake and a speed FOV kick.

import { Vector3 } from 'three';
import { CAMERA as C } from '../config/game.js';
import { Frame } from '../track/path.js';
import { damp } from '../core/math.js';

const _pos = new Vector3();
const _up = new Vector3();
const _look = new Vector3();
const _fwd = new Vector3();
const fc = new Frame();
const fcar = new Frame();

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.pos = new Vector3();
    this.up = new Vector3(0, 1, 0);
    this.look = new Vector3();
    this.airFwd = new Vector3(0, 0, 1);
    this.rigid = 1; // 1 = locked to the track, 0 = free chase
    this.shakeAmp = 0;
    this.shakeT = 0;
    this.fovKick = 0;
    this.baseFov = C.fovPortrait;
  }

  setAspect(aspect) {
    this.baseFov = aspect < 1 ? C.fovPortrait : C.fovLandscape;
    this.camera.aspect = aspect;
  }

  shake(amount) {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
  }

  /** Jump straight to the resting position behind the car. */
  reset(car) {
    this.rigid = 1;
    this.targets(car);
    this.pos.copy(_pos);
    this.up.copy(_up);
    this.look.copy(_look);
    this.apply(0);
  }

  /** Where the camera wants to be: writes _pos, _up, _look. */
  targets(car) {
    const path = car.path;
    const f = path.sampleAt(car.trackS, fcar);
    if (car.mode === 'ground') {
      path.sampleAt(Math.max(0, car.s - C.distance), fc);
      _pos.copy(fc.pos).addScaledVector(fc.R, car.x * 0.6).addScaledVector(fc.U, C.height);
      _up.copy(fc.U).add(f.U).normalize();
      _look.copy(car.pos).addScaledVector(f.T, C.lookAhead).addScaledVector(f.U, C.lookHeight);
      this.airFwd.copy(f.T);
      return;
    }
    // In the air: behind the flight path, mostly level, up blends to the road below.
    _fwd.copy(car.vel).normalize().multiplyScalar(0.6).addScaledVector(f.T, 0.4).normalize();
    this.airFwd.lerp(_fwd, 0.08).normalize();
    _up.copy(f.U).multiplyScalar(0.5).add(fc.U.set(0, 1, 0)).normalize();
    _up.addScaledVector(this.airFwd, -_up.dot(this.airFwd)).normalize();
    _pos.copy(car.pos).addScaledVector(this.airFwd, -C.distance).addScaledVector(_up, C.height);
    _look.copy(car.pos).addScaledVector(this.airFwd, C.lookAhead).addScaledVector(_up, C.lookHeight);
  }

  update(dt, car, { speedFov = 0 } = {}) {
    this.rigid = car.mode === 'ground' ? Math.min(1, this.rigid + dt / 0.7) : 0;
    this.targets(car);
    const k = this.rigid * this.rigid;
    const rate = 10 + k * 40;
    this.pos.lerp(_pos, damp(rate, dt));
    this.up.lerp(_up, damp(4 + k * 26, dt)).normalize();
    this.look.lerp(_look, damp(rate * 1.5, dt));
    this.fovKick += (speedFov - this.fovKick) * damp(3, dt);
    this.apply(dt);
  }

  apply(dt) {
    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.shakeAmp > 0.001 && dt > 0) {
      this.shakeT += dt * 40;
      const a = this.shakeAmp;
      cam.position.x += Math.sin(this.shakeT * 1.3) * a;
      cam.position.y += Math.sin(this.shakeT * 1.7 + 1) * a;
      cam.position.z += Math.sin(this.shakeT * 1.1 + 2) * a;
      this.shakeAmp *= Math.exp(-6 * dt);
    }
    cam.up.copy(this.up);
    cam.lookAt(this.look);
    const fov = this.baseFov + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }
}
