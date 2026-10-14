// Player walking: camera-relative movement, collision against the stage's
// collider boxes, and a follow camera whose angle comes from the area the player is in.
import * as THREE from 'three';
import { readInput } from './input.js';
import { applyFov } from './renderer.js';

const SPEED = 1.7;        // m/s at full stick
const RADIUS = 0.2;       // player's footprint
const TURN = 12;          // how fast the character turns to face movement
const CAM_FOLLOW = 4;     // camera smoothing (higher = snappier)
const LOOK_HEIGHT = 1.1;  // camera aims at the chest/head, not the feet

function contains([x0, z0, x1, z1], p) {
  return p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1;
}

function clampTo(rect, v) {
  if (!rect) return v;
  const [x0, z0, x1, z1] = rect;
  v.x = THREE.MathUtils.clamp(v.x, x0, x1);
  v.z = THREE.MathUtils.clamp(v.z, z0, z1);
  return v;
}

/** Pushes a circle at (p.x, p.z) out of every box it overlaps (sliding along walls). */
function resolveCollisions(p, colliders) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const cx = THREE.MathUtils.clamp(p.x, c.minX, c.maxX);
      const cz = THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x += (dx / d) * (RADIUS - d);
        p.z += (dz / d) * (RADIUS - d);
      } else {
        // Center is inside the box: leave through the nearest side.
        const exits = [
          [c.minX - RADIUS - p.x, 0], [c.maxX + RADIUS - p.x, 0],
          [0, c.minZ - RADIUS - p.z], [0, c.maxZ + RADIUS - p.z],
        ];
        exits.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        p.x += exits[0][0];
        p.z += exits[0][1];
      }
    }
  }
}

export class WalkController {
  constructor({ stage, camera, areas }) {
    this.stage = stage;
    this.camera = camera;
    this.areas = areas;
    this.active = false;
    this.area = areas[0];
    this.look = new THREE.Vector3();
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

  stop() {
    this.active = false;
    this.character?.walk(0, 0);
  }

  updateArea() {
    const p = this.body.position;
    const area = this.areas.find((a) => contains(a.rect, p));
    if (area && area !== this.area) this.area = area;
    applyFov(this.camera, this.area.camera.fov ?? 50);
  }

  cameraTarget() {
    const target = this.body.position.clone().add(new THREE.Vector3(...this.area.camera.offset));
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

      const yaw = Math.atan2(move.x, move.z);
      let diff = yaw - this.body.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.body.rotation.y += diff * Math.min(1, dt * TURN);
    }
    this.character.walk(dt, amount);

    this.updateArea();
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
