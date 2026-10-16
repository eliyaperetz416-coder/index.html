// Draws a Race: track, world, items, car model, camera and effects. Track and world meshes are
// kept between races on the same track and disposed when the track changes.

import { Vector3, Matrix4, Color, Sprite, SpriteMaterial } from 'three';
import { labelTexture } from '../render/textures.js';
import { buildTrackMeshes } from '../render/trackMesh.js';
import { buildWorld } from '../render/world.js';
import { createModel, createShadow, disposeObject } from '../render/models.js';
import { ChaseCamera } from '../render/camera.js';
import { Particles, SpeedLines, COLORS } from '../render/effects.js';
import { ItemsView } from './itemsView.js';
import { WORLD_BY_ID, WORLDS } from '../config/worlds.js';
import { Frame } from '../track/path.js';
import { damp } from '../core/math.js';

let scenery = null; // { trackId, track, world }

const _m = new Matrix4();
const _v = new Vector3();
const _v2 = new Vector3();
const _look = new Vector3();
const _c = new Color();
const _f = new Frame(); // reused every frame: no garbage in the render loop

export function worldOf(track) {
  return WORLD_BY_ID[track.world] ?? WORLDS[0];
}

function ensureScenery(r, race) {
  const id = race.track.id;
  if (scenery?.trackId === id && scenery.quality === r.quality.name && scenery.def === race.track) return scenery;
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
  scenery = { trackId: id, def: race.track, quality: r.quality.name, track, world: env };
  return scenery;
}

/** Particle pools are shared by every race (allocated once). */
let fx = null;
function ensureFx(r) {
  if (fx) return fx;
  const q = r.quality.particles ?? 1;
  fx = {
    sparks: new Particles(Math.round(260 * q), { additive: true }),
    glow: new Particles(Math.round(320 * q), { additive: true }),
    smoke: new Particles(Math.round(160 * q), { additive: false }),
    lines: new SpeedLines(Math.round(46 * q)),
  };
  r.scene.add(fx.sparks.points, fx.glow.points, fx.smoke.points);
  r.scene.add(r.camera);
  r.camera.add(fx.lines.mesh);
  return fx;
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
    this.fx = ensureFx(r);
    for (const p of [this.fx.sparks, this.fx.glow, this.fx.smoke]) p.clear();
    this.items = new ItemsView(r.scene, race, r.quality);
    this.car = createModel('car', carDef, { ...look, quality: r.quality });
    this.carDef = carDef;
    this.shadow = createShadow(carDef.body.width, carDef.body.length);
    r.scene.add(this.car, this.shadow);
    // Rivals: their own car, a glow and a floating name tag.
    this.rivals = race.rivals.map((rv) => {
      const model = createModel('car', rv.def, { paint: { color: rv.def.body.paint, metal: 0.7, rough: 0.3 }, rim: { style: 'star', color: rv.glow ?? '#ff2b4a' }, glow: rv.glow ?? '#ff2b4a', quality: r.quality });
      const tag = new Sprite(new SpriteMaterial({ map: labelTexture(rv.name, rv.glow), depthTest: false, transparent: true }));
      tag.scale.set(5, 1.25, 1);
      tag.renderOrder = 30;
      const shadow = createShadow(rv.def.body.width, rv.def.body.length);
      r.scene.add(model, tag, shadow);
      return { rv, model, tag, shadow, spin: 0 };
    });
    this.cam = new ChaseCamera(r.camera);
    this.cam.setAspect(r.camera.aspect);
    r.onResize.push((this.resize = (w, h) => this.cam.setAspect(w / h)));
    this.wheelSpin = 0;
    this.bounce = 0; // suspension offset
    this.bounceV = 0;
    this.orbitT = 0;
    this.time = 0;
    this.kick = 0; // extra FOV from boosts
    this.cam.reset(race.car);
  }

  /** Car-local point (x left, y up, z forward) to world. */
  local(x, y, z, out) {
    return out.set(x, y, z).applyQuaternion(this.car.quaternion).add(this.car.position);
  }

  burst(pool, at, n, { speed = 8, up = 3, life = 0.5, size = 0.5, color = COLORS.spark, gravity = 12, drag = 2, base = null, grow = 0, alpha = 1 }) {
    for (let i = 0; i < n; i++) {
      _v2.set((Math.random() - 0.5) * 2, Math.random() * up / Math.max(1, speed), (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      if (base) _v2.add(base);
      pool.spawn(at, _v2, { life: life * (0.6 + Math.random() * 0.6), size, color, gravity, drag, grow, alpha });
    }
  }

  /** Hand race events to the view: bumps, shakes, particles. */
  onEvent(e) {
    const car = this.race.car;
    const { sparks, glow, smoke } = this.fx;
    switch (e.type) {
      case 'land':
        this.bounceV -= Math.min(6, (e.impact ?? 0) * 0.35);
        if (e.impact > 8) {
          this.cam.shake(Math.min(0.5, e.impact * 0.025));
          this.burst(smoke, this.local(0, 0.2, -1.5, _v), 10, { speed: 5, up: 2, life: 0.9, size: 2.2, grow: 3, color: COLORS.smoke, gravity: 0, alpha: 0.5 });
          this.burst(sparks, this.local(0, 0.2, 0, _v), 14, { speed: 9, life: 0.4, size: 0.35 });
        }
        break;
      case 'crash':
        this.cam.shake(0.8);
        this.bounceV -= 4;
        this.burst(sparks, car.pos, 40, { speed: 14, up: 8, life: 0.7, size: 0.45 });
        this.burst(smoke, car.pos, 14, { speed: 4, life: 1.2, size: 2.5, grow: 3, color: COLORS.smoke, gravity: -1, alpha: 0.6 });
        break;
      case 'wall':
        this.cam.shake(Math.min(0.35, e.impact * 0.05));
        this.burst(sparks, this.local(e.side > 0 ? -1 : 1, 0.4, 0.5, _v), Math.min(24, 6 + e.impact * 3), { speed: 9, life: 0.45, size: 0.3, base: car.vel });
        break;
      case 'hit':
        this.cam.shake(0.6);
        this.bounceV -= 3;
        this.burst(sparks, this.local(0, 0.6, 1.8, _v), 36, { speed: 13, up: 6, life: 0.6, size: 0.45, color: COLORS.sparkHot });
        this.burst(glow, this.local(0, 0.6, 1.8, _v), 10, { speed: 6, life: 0.35, size: 1.8, color: COLORS.hit, gravity: 0 });
        break;
      case 'boost':
        this.kick = Math.max(this.kick, 10);
        this.cam.shake(0.15);
        this.burst(glow, this.local(0, 0.1, 0, _v), 18, { speed: 7, up: 6, life: 0.5, size: 0.9, color: COLORS.boost, gravity: 0, base: car.vel });
        break;
      case 'nitro':
        this.kick = Math.max(this.kick, 16);
        this.cam.shake(0.3);
        this.burst(glow, this.local(0, 0.6, -2.2, _v), 30, { speed: 8, life: 0.5, size: 1.4, color: COLORS.nitro, gravity: 0, base: car.vel });
        break;
      case 'coin':
        this.burst(glow, this.local(0, 1.2, 1.5, _v), 6, { speed: 5, up: 5, life: 0.4, size: 0.6, color: COLORS.coin, gravity: 6, base: car.vel });
        break;
      case 'nearMiss':
        this.burst(glow, this.local(0, 0.8, 0, _v), 12, { speed: 6, life: 0.5, size: 0.7, color: COLORS.nitro, gravity: 0, base: car.vel });
        break;
      case 'rammed':
      case 'ramRival': {
        this.cam.shake(e.type === 'rammed' ? 0.5 : 0.3);
        const rv = this.race.rivals[0]?.car;
        if (rv) {
          _v.copy(car.pos).add(rv.pos).multiplyScalar(0.5);
          _v.y += 0.6;
          this.burst(sparks, _v, 30, { speed: 12, up: 6, life: 0.5, size: 0.4, color: COLORS.sparkHot });
        }
        break;
      }
      case 'bumped':
        this.cam.shake(0.2);
        break;
      case 'respawn':
        this.cam.reset(car);
        this.burst(glow, car.pos, 30, { speed: 6, up: 6, life: 0.6, size: 1, color: COLORS.nitro, gravity: 0 });
        break;
      default:
    }
  }

  emitTrails(dt) {
    const car = this.race.car;
    const { glow, smoke } = this.fx;
    const L = this.carDef.body.length;
    const W = this.carDef.body.width;
    // Nitro / boost flames from the exhausts.
    if (car.boostTime > 0) {
      const n = Math.ceil(dt * 90);
      this.local(0, 0, -1, _look).sub(this.car.position); // backwards, world space
      for (let i = 0; i < n; i++) {
        for (const side of [-0.28, 0.28]) {
          this.local(side * W, 0.45, -L / 2 - 0.1, _v);
          _v2.copy(car.vel).multiplyScalar(0.85).addScaledVector(_look, 6 + Math.random() * 4);
          glow.spawn(_v, _v2, { life: 0.18 + Math.random() * 0.1, size: 0.9 + Math.random() * 0.5, color: car.boostPower > 0.3 ? COLORS.nitro : COLORS.flame, gravity: 0, drag: 0, grow: -2 });
          if (Math.random() < 0.4) glow.spawn(_v, _v2, { life: 0.1, size: 0.5, color: COLORS.nitroCore, drag: 0, gravity: 0 });
        }
      }
    }
    // Tyre smoke while drifting.
    if (car.drifting && car.mode === 'ground') {
      const n = Math.ceil(dt * 40);
      for (let i = 0; i < n; i++) {
        for (const side of [-1, 1]) {
          this.local(side * W * 0.45, 0.2, -L * 0.32, _v);
          _v2.copy(car.vel).multiplyScalar(0.3);
          _v2.x += (Math.random() - 0.5) * 2;
          _v2.y += 1 + Math.random();
          _v2.z += (Math.random() - 0.5) * 2;
          smoke.spawn(_v, _v2, { life: 0.7 + Math.random() * 0.4, size: 1.2, grow: 3.5, color: COLORS.smoke, alpha: 0.35, drag: 1.5, gravity: -0.5 });
        }
        if (Math.random() < 0.5) {
          this.local((Math.random() < 0.5 ? -1 : 1) * W * 0.45, 0.1, -L * 0.32, _v);
          _c.setHSL(Math.random() < 0.5 ? 0.85 : 0.5, 1, 0.6);
          glow.spawn(_v, _v2.copy(car.vel).multiplyScalar(0.5), { life: 0.25, size: 0.35, color: _c, gravity: 4, drag: 2 });
        }
      }
    }
  }

  update(dt, input) {
    this.time += dt;
    const car = this.race.car;
    const model = this.car;
    model.position.copy(car.pos);
    model.quaternion.copy(car.quat);
    // Blink while immune after a hit.
    model.visible = car.invuln <= 0 || Math.floor(car.invuln * 14) % 2 === 0;

    // Suspension spring and body lean.
    this.bounceV += (-this.bounce * 160 - this.bounceV * 14) * dt;
    this.bounce += this.bounceV * dt;
    const parts = model.userData.parts;
    if (parts.body) {
      parts.body.position.y = Math.max(-0.25, this.bounce * 0.12);
      const lean = car.mode === 'ground' ? -(input?.steer ?? 0) * Math.min(1, car.v / 30) * (car.drifting ? 0.12 : 0.07) : 0;
      parts.body.rotation.z += (lean - parts.body.rotation.z) * damp(8, dt);
      const squat = car.boostTime > 0 ? -0.05 : 0;
      parts.body.rotation.x += (squat - parts.body.rotation.x) * damp(6, dt);
    }
    this.wheelSpin += car.v * dt / 0.38;
    for (const w of parts.wheels ?? []) {
      if (w.userData.spin) w.userData.spin.rotation.x = this.wheelSpin;
      if (w.userData.front) w.rotation.y = -(input?.steer ?? 0) * 0.35;
    }

    this.placeShadow(this.shadow, car);

    this.updateRivals(dt);
    this.emitTrails(dt);
    this.kick *= Math.exp(-1.5 * dt);
    const speed = car.speed;
    const boosting = car.boostTime > 0;
    const fov = Math.max(0, (speed - 30) * 0.25) + (boosting ? 6 : 0) + this.kick;
    this.cam.update(dt, car, { speedFov: fov });
    this.items.update(dt, this.race.time, this.r.camera);
    this.updateFx(dt, Math.min(1, Math.max(0, (speed - 38) / 20) + (boosting ? 0.6 : 0)), speed);
  }

  updateRivals(dt) {
    for (const e of this.rivals) {
      const c = e.rv.car;
      e.model.position.copy(c.pos);
      e.model.quaternion.copy(c.quat);
      e.spin += c.v * dt / 0.5;
      for (const w of e.model.userData.parts.wheels ?? []) if (w.userData.spin) w.userData.spin.rotation.x = e.spin;
      const f = c.path.sampleAt(c.trackS, _f);
      e.tag.position.copy(c.pos).addScaledVector(f.U, 3.4);
      e.tag.visible = this.r.camera.position.distanceTo(c.pos) < 160;
      this.placeShadow(e.shadow, c);
    }
  }

  /** Blob shadow on the road under a car. */
  placeShadow(shadow, car) {
    const pr = car.proj;
    const f = car.path.sampleAt(car.trackS, _f);
    const h = car.mode === 'ground' ? 0 : Math.max(0, pr.h);
    if (Math.abs(pr.x) < f.width / 2 + 1 && h < 30 && car.path.flagsAt(car.trackS) & 1) {
      shadow.visible = true;
      _v.copy(f.pos).addScaledVector(f.R, pr.x).addScaledVector(f.U, 0.04);
      _m.makeBasis(f.R, f.T, f.U).setPosition(_v);
      shadow.quaternion.setFromRotationMatrix(_m);
      shadow.position.copy(_v);
      const k = 1 / (1 + h * 0.12);
      shadow.scale.setScalar(k);
      shadow.material.opacity = k;
    } else {
      shadow.visible = false;
    }
  }

  updateFx(dt, lineK, speed) {
    const cam = this.r.camera;
    const pxScale = this.r.renderer.domElement.height * 0.5 / Math.tan((cam.fov * Math.PI) / 360);
    for (const p of [this.fx.sparks, this.fx.glow, this.fx.smoke]) {
      p.setScale(pxScale);
      p.update(dt);
    }
    this.fx.lines.update(dt, lineK, speed);
    this.scenery.world.userData.follow(cam.position);
  }

  /** Swap the car model (garage preview, different car or cosmetics). */
  setCar(carDef, look) {
    this.r.scene.remove(this.car);
    disposeObject(this.car);
    this.car = createModel('car', carDef, { ...look, quality: this.r.quality });
    this.carDef = carDef;
    this.r.scene.add(this.car);
  }

  /**
   * Menu background: slow orbit around the parked car.
   * framing: 'menu' (car above the big button) or 'garage' (closer, car in the top third).
   */
  orbit(dt, framing = 'menu') {
    const car = this.race.car;
    this.orbitT += dt * (framing === 'garage' ? 0.35 : 0.25);
    const cam = this.r.camera;
    const f = car.path.sampleAt(car.trackS, _f);
    const garage = framing === 'garage';
    _v.copy(f.T).applyAxisAngle(f.U, this.orbitT + (garage ? 2.4 : 0)).multiplyScalar(garage ? 9.5 : 10);
    cam.position.copy(car.pos).add(_v).addScaledVector(f.U, garage ? 3.2 : 2.6);
    cam.up.copy(f.U);
    // Aim below the car so it sits in the upper part of the screen, above the menus.
    cam.lookAt(_look.copy(car.pos).addScaledVector(f.U, garage ? -3.4 : -2.2));
    this.car.position.copy(car.pos);
    this.car.quaternion.copy(car.quat);
    this.car.visible = true;
    this.shadow.visible = false;
    this.updateRivals(0);
    this.items.update(dt, this.orbitT * 4, cam);
    this.updateFx(dt, 0, 0);
  }

  dispose() {
    this.r.scene.remove(this.car, this.shadow);
    disposeObject(this.car);
    disposeObject(this.shadow);
    for (const e of this.rivals) {
      this.r.scene.remove(e.model, e.tag, e.shadow);
      disposeObject(e.model);
      disposeObject(e.shadow);
      e.tag.material.map.dispose();
      e.tag.material.dispose();
    }
    this.items.dispose();
    const i = this.r.onResize.indexOf(this.resize);
    if (i >= 0) this.r.onResize.splice(i, 1);
  }
}
