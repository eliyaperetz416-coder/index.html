// Plays a data-driven cutscene: camera shots, captions, sounds, lights, poses, actions.
import * as THREE from 'three';
import { applyFov } from './renderer.js';
import { playSound } from './audio.js';

const ease = (k) => k * k * (3 - 2 * k);
const v3 = (a) => new THREE.Vector3(...a);

export class CutscenePlayer {
  constructor({ stage, camera, ui }) {
    this.stage = stage;
    this.camera = camera;
    this.ui = ui;
    this.active = null;
  }

  play(cutscene) {
    return new Promise((resolve) => {
      this.active = { shots: cutscene.shots, index: -1, t: 0, resolve, shake: null };
      this.ui.letterbox(true);
      this.nextShot();
    });
  }

  nextShot() {
    const a = this.active;
    a.index += 1;
    a.t = 0;
    a.fired = new Set();
    if (a.index >= a.shots.length) {
      this.ui.letterbox(false);
      this.ui.caption(null);
      this.active = null;
      a.resolve();
      return;
    }
    this.update(0);
  }

  /**
   * Jumps to the end: fast-forwards the rest silently, so everything the
   * cutscene changes (notebook landed, poses, lights) ends up in its final state.
   */
  skip() {
    if (!this.active) return;
    this.skipping = true;
    const step = 1 / 20;
    while (this.active) {
      this.stage.update(step);
      this.update(step);
    }
    this.skipping = false;
  }

  fire(event) {
    const { stage } = this;
    if (event.sound && !this.skipping) playSound(event.sound, event);
    if (event.action) stage[event.action](event);
    if (event.pose) stage.setPose({ target: event.target, pose: event.pose, duration: event.duration });
    if (event.lights) stage.setLights(event);
    if (event.shake && !this.skipping) this.active.shake = { amount: event.shake, t: 0, duration: event.duration ?? 0.3 };
  }

  update(dt) {
    const a = this.active;
    if (!a) return;
    a.t += dt;
    const shot = a.shots[a.index];
    const k = ease(Math.min(a.t / shot.duration, 1));

    for (const [i, ev] of (shot.events ?? []).entries()) {
      if (!a.fired.has(i) && a.t >= ev.at) { a.fired.add(i); this.fire(ev); }
    }
    for (const [i, cap] of (shot.captions ?? []).entries()) {
      const key = `c${i}`;
      if (!a.fired.has(key) && a.t >= cap.at) { a.fired.add(key); this.ui.caption(cap); }
      if (a.fired.has(key) && !a.fired.has(`${key}end`) && a.t >= cap.at + cap.for) {
        a.fired.add(`${key}end`);
        this.ui.caption(null);
      }
    }

    const cam = this.camera;
    cam.position.lerpVectors(v3(shot.camera.from), v3(shot.camera.to), k);
    const look = new THREE.Vector3();
    if (shot.look.track) {
      this.stage.objects[shot.look.track].getWorldPosition(look);
      look.add(v3(shot.look.offset ?? [0, 0, 0]));
    } else {
      look.lerpVectors(v3(shot.look.from), v3(shot.look.to), k);
    }
    if (a.shake) {
      a.shake.t += dt;
      const fade = Math.max(0, 1 - a.shake.t / a.shake.duration);
      const s = a.shake.amount * fade;
      cam.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0));
      if (fade === 0) a.shake = null;
    }
    cam.lookAt(look);
    if (shot.fov) applyFov(cam, THREE.MathUtils.lerp(shot.fov[0], shot.fov[1], k));

    if (a.t >= shot.duration) this.nextShot();
  }
}
