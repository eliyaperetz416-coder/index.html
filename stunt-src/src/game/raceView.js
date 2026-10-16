// Draws a Race: track, world, car model and camera. Track and world meshes are kept between
// races on the same track and disposed when the track changes.

import { Vector3, Matrix4 } from 'three';
import { buildTrackMeshes } from '../render/trackMesh.js';
import { buildWorld } from '../render/world.js';
import { createModel, createShadow, disposeObject } from '../render/models.js';
import { ChaseCamera } from '../render/camera.js';
import { WORLD_BY_ID, WORLDS } from '../config/worlds.js';
import { damp } from '../core/math.js';

let scenery = null; // { trackId, track, world }

const _m = new Matrix4();
const _v = new Vector3();
const _look = new Vector3();

export function worldOf(track) {
  return WORLD_BY_ID[track.world] ?? WORLDS[0];
}

function ensureScenery(r, race) {
  const id = race.track.id;
  if (scenery?.trackId === id && scenery.quality === r.quality.name) return scenery;
  if (scenery) {
    r.scene.remove(scenery.track, scenery.world);
    scenery.track.userData.dispose();
    scenery.world.userData.dispose();
  }
  const world = worldOf(race.track);
  r.setEnvironment(world.env);
  const track = buildTrackMeshes(race.path, world);
  const env = buildWorld(r.scene, world, race.path, r.quality);
  r.scene.add(env, track);
  scenery = { trackId: id, quality: r.quality.name, track, world: env };
  return scenery;
}

export class RaceView {
  /**
   * @param {import('../render/renderer.js').Renderer} r
   * @param {import('./race.js').Race} race
   * @param {{carDef: object, look: object}} opts
   */
  constructor(r, race, { carDef, look }) {
    this.r = r;
    this.race = race;
    this.scenery = ensureScenery(r, race);
    this.car = createModel('car', carDef, { ...look, quality: r.quality });
    this.shadow = createShadow(carDef.body.width, carDef.body.length);
    r.scene.add(this.car, this.shadow);
    this.cam = new ChaseCamera(r.camera);
    this.cam.setAspect(r.camera.aspect);
    r.onResize.push((this.resize = (w, h) => this.cam.setAspect(w / h)));
    this.wheelSpin = 0;
    this.bounce = 0; // suspension offset
    this.bounceV = 0;
    this.orbitT = 0;
    this.cam.reset(race.car);
  }

  /** Hand car events to the view (bumps, shakes). */
  onEvent(e) {
    if (e.type === 'land') {
      this.bounceV -= Math.min(6, (e.impact ?? 0) * 0.35);
      if (e.impact > 8) this.cam.shake(Math.min(0.5, e.impact * 0.025));
    } else if (e.type === 'crash') {
      this.cam.shake(0.7);
      this.bounceV -= 4;
    } else if (e.type === 'wall') {
      this.cam.shake(Math.min(0.35, e.impact * 0.05));
    } else if (e.type === 'respawn') {
      this.cam.reset(this.race.car);
    }
  }

  update(dt, input) {
    const car = this.race.car;
    const model = this.car;
    model.position.copy(car.pos);
    model.quaternion.copy(car.quat);

    // Suspension spring and body lean.
    this.bounceV += (-this.bounce * 160 - this.bounceV * 14) * dt;
    this.bounce += this.bounceV * dt;
    const parts = model.userData.parts;
    if (parts.body) {
      parts.body.position.y = Math.max(-0.25, this.bounce * 0.12);
      const lean = car.mode === 'ground' ? -(input?.steer ?? 0) * Math.min(1, car.v / 30) * 0.07 : 0;
      parts.body.rotation.z += (lean - parts.body.rotation.z) * damp(8, dt);
    }
    this.wheelSpin += (car.mode === 'ground' ? car.v : car.v * 0.98) * dt / 0.38;
    for (const w of parts.wheels ?? []) {
      if (w.userData.spin) w.userData.spin.rotation.x = this.wheelSpin;
      if (w.userData.front) w.rotation.y = -(input?.steer ?? 0) * 0.35;
    }

    // Blob shadow on the road under the car.
    const pr = car.proj;
    const f = car.path.sampleAt(car.trackS);
    const h = car.mode === 'ground' ? 0 : Math.max(0, pr.h);
    if (Math.abs(pr.x) < f.width / 2 + 1 && h < 30 && car.path.flagsAt(car.trackS) & 1) {
      this.shadow.visible = true;
      _v.copy(f.pos).addScaledVector(f.R, pr.x).addScaledVector(f.U, 0.04);
      _m.makeBasis(f.R, f.T, f.U).setPosition(_v);
      this.shadow.quaternion.setFromRotationMatrix(_m);
      this.shadow.position.copy(_v);
      const k = 1 / (1 + h * 0.12);
      this.shadow.scale.setScalar(k);
      this.shadow.material.opacity = k;
    } else {
      this.shadow.visible = false;
    }

    const kmh = car.speed;
    this.cam.update(dt, car, { speedFov: Math.max(0, (kmh - 30) * 0.25) });
    this.scenery.world.userData.follow(this.r.camera.position);
  }

  /** Menu background: slow orbit around the parked car. */
  orbit(dt) {
    const car = this.race.car;
    this.orbitT += dt * 0.25;
    const cam = this.r.camera;
    const f = car.path.sampleAt(car.trackS);
    _v.copy(f.T).applyAxisAngle(f.U, this.orbitT).multiplyScalar(10);
    cam.position.copy(car.pos).add(_v).addScaledVector(f.U, 2.6);
    cam.up.copy(f.U);
    // Aim below the car so it sits in the upper half, above the big start button.
    cam.lookAt(_look.copy(car.pos).addScaledVector(f.U, -2.2));
    this.car.position.copy(car.pos);
    this.car.quaternion.copy(car.quat);
    this.shadow.visible = false;
    this.scenery.world.userData.follow(cam.position);
  }

  dispose() {
    this.r.scene.remove(this.car, this.shadow);
    disposeObject(this.car);
    disposeObject(this.shadow);
    const i = this.r.onResize.indexOf(this.resize);
    if (i >= 0) this.r.onResize.splice(i, 1);
  }
}
