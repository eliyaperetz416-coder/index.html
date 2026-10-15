// Player walking: camera-relative movement, collision against the stage's
// collider boxes, and a follow camera whose angle comes from the area the player is in.
import * as THREE from 'three';
import { readInput, takeLook } from './input.js';
import { orbitOffset, addLook } from './orbit.js';
import { applyFov } from './renderer.js';
import { resolveCollisions } from './collision.js';
import { FloorSampler } from './floor.js';

const SPEED = 1.7;        // m/s at full stick
const TURN = 12;          // how fast the character turns to face movement
const CAM_FOLLOW = 4;     // camera smoothing (higher = snappier)
const LOOK_HEIGHT = 1.1;  // camera aims at the chest/head, not the feet

/** An area matches by its x/z rect and, if given, its height range y: [min, max]. */
function contains({ rect: [x0, z0, x1, z1], y }, p) {
  return p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && (!y || (p.y >= y[0] && p.y <= y[1]));
}

function clampTo(rect, v) {
  if (!rect) return v;
  const [x0, z0, x1, z1] = rect;
  v.x = THREE.MathUtils.clamp(v.x, x0, x1);
  v.z = THREE.MathUtils.clamp(v.z, z0, z1);
  return v;
}

export class WalkController {
  constructor({ stage, camera, areas }) {
    this.stage = stage;
    this.camera = camera;
    this.areas = areas;
    this.active = false;
    this.area = areas[0];
    this.look = new THREE.Vector3();
    this.view = { yaw: 0, tilt: 0 };   // player-controlled camera angle, relative to the area's default
    this.floor = new FloorSampler(stage.walkSurfaces);
  }

  start(id) {
    this.body = this.stage.objects[id];
    this.character = this.stage.characters[id];
    this.active = true;
    this.updateArea();
    this.camera.position.copy(this.cameraTarget());
    this.look.copy(this.body.position).y += LOOK_HEIGHT;
    this.camera.lookAt(this.look);
  }

  /** Continues walking after stop(), without re-placing the camera. */
  resume() {
    this.active = true;
  }

  stop() {
    this.active = false;
    this.character?.walk(0, 0);
  }

  updateArea() {
    const p = this.body.position;
    const area = this.areas.find((a) => contains(a, p));
    if (area && area !== this.area) {
      this.area = area;
      this.view = { yaw: 0, tilt: 0 };   // each area has its own framing: start from it again
    }
    applyFov(this.camera, this.area.camera.fov ?? 50);
  }

  cameraTarget() {
    const target = this.body.position.clone().add(orbitOffset(this.area.camera.offset, this.view.yaw, this.view.tilt));
    return clampTo(this.area.camera.clamp, target);
  }

  update(dt) {
    if (!this.active) return;
    const input = readInput();
    const amount = Math.min(1, Math.hypot(input.x, input.y));

    if (amount > 0) {
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const move = right.multiplyScalar(input.x).addScaledVector(fwd, input.y);
      const p = this.body.position;
      p.addScaledVector(move, SPEED * dt);
      resolveCollisions(p, this.stage.colliders);
      // Stand on the floor / stairs below; over a gap keep the last height (never fall through).
      const h = this.floor.heightAt(p.x, p.z, p.y);
      if (h !== null) p.y = h;

      const yaw = Math.atan2(move.x, move.z);
      let diff = yaw - this.body.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.body.rotation.y += diff * Math.min(1, dt * TURN);
    }
    this.character.walk(dt, amount);

    this.updateArea();
    const drag = takeLook();
    if (drag.dx || drag.dy) this.view = addLook(this.view, drag.dx, drag.dy);
    const k = 1 - Math.exp(-dt * CAM_FOLLOW);
    this.camera.position.lerp(this.cameraTarget(), k);
    const lookTarget = this.body.position.clone();
    lookTarget.y += LOOK_HEIGHT;
    this.look.lerp(lookTarget, k * 1.5);
    this.camera.lookAt(this.look);
  }

  distanceTo(name) {
    const target = this.stage.node(name).getWorldPosition(new THREE.Vector3());
    return Math.hypot(target.x - this.body.position.x, target.z - this.body.position.z);
  }
}
