// Rigid-part characters (no skinning): poses are joint rotations from data/poses.json.
import * as THREE from 'three';
import poses from '../../data/poses.json';

const DEG = Math.PI / 180;

function poseTargets(name) {
  const pose = poses[name];
  if (!pose) throw new Error(`Unknown pose: ${name}`);
  const joints = {};
  for (const [joint, rot] of Object.entries(pose)) {
    if (joint === 'root' || joint.startsWith('_')) continue;
    joints[joint] = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG));
  }
  return { root: new THREE.Vector3(...(pose.root ?? [0, 0, 0])), joints };
}

export class Character {
  constructor(model) {
    this.model = model;
    this.joints = {};
    this.rest = {};
    model.traverse((o) => {
      if (!o.name || this.joints[o.name]) return;
      this.joints[o.name] = o;
      this.rest[o.name] = o.quaternion.clone();
    });
    this.tween = null;
  }

  /** Jumps to a pose, or blends to it over `duration` seconds. */
  setPose(name, duration = 0) {
    const target = poseTargets(name);
    const from = {
      root: this.model.position.clone(),
      joints: Object.fromEntries(Object.values(this.joints).map((j) => [j.name, j.quaternion.clone()])),
    };
    // Pose rotations are relative to the rest pose; joints a pose does not mention return to rest.
    for (const [name, rest] of Object.entries(this.rest)) {
      target.joints[name] = rest.clone().multiply(target.joints[name] ?? new THREE.Quaternion());
    }
    this.tween = { from, target, t: 0, duration };
    if (duration <= 0) this.update(0);
  }

  update(dt) {
    const tw = this.tween;
    if (!tw) return;
    tw.t += dt;
    const k = tw.duration > 0 ? Math.min(tw.t / tw.duration, 1) : 1;
    const e = k * k * (3 - 2 * k);
    this.model.position.lerpVectors(tw.from.root, tw.target.root, e);
    for (const [name, q] of Object.entries(tw.target.joints)) {
      const joint = this.joints[name];
      if (joint) joint.quaternion.slerpQuaternions(tw.from.joints[name], q, e);
    }
    if (k >= 1) this.tween = null;
  }
}
