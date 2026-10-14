// Skinned characters: poses from data/poses.json drive the skeleton's bones.
// Pose angles are written in character space (x = bend forward, y = turn, z = tilt sideways),
// whatever the bone's own rest orientation is; poseToLocal converts them per bone.
import * as THREE from 'three';
import poses from '../../data/poses.json';

const DEG = Math.PI / 180;

/**
 * Local rotation for a bone so that it is rotated by `rot` (character space) about its joint,
 * relative to its parent at rest: rest · restWorld⁻¹ · rot · restWorld.
 */
export function poseToLocal(rest, restWorld, rot) {
  return rest.clone().multiply(restWorld.clone().invert()).multiply(rot).multiply(restWorld);
}

function poseRotations(name) {
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
    this.restWorld = {};
    model.updateMatrixWorld(true);
    const rootInv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    model.traverse((o) => {
      if (!o.isBone || this.joints[o.name]) return;
      this.joints[o.name] = o;
      this.rest[o.name] = o.quaternion.clone();
      this.restWorld[o.name] = rootInv.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
    });
    this.tween = null;
    this.walkPhase = 0;
    this.walkBlend = 0;
    this.walkPoses = null;
  }

  /** Target bone rotations for a pose; bones the pose does not mention return to rest. */
  resolve(name) {
    const { root, joints } = poseRotations(name);
    const target = { root, joints: {} };
    for (const [bone, rest] of Object.entries(this.rest)) {
      target.joints[bone] = joints[bone] ? poseToLocal(rest, this.restWorld[bone], joints[bone]) : rest.clone();
    }
    return target;
  }

  /** Jumps to a pose, or blends to it over `duration` seconds. */
  setPose(name, duration = 0) {
    const target = this.resolve(name);
    const from = {
      root: this.model.position.clone(),
      joints: Object.fromEntries(Object.entries(this.joints).map(([n, j]) => [n, j.quaternion.clone()])),
    };
    this.tween = { from, target, t: 0, duration };
    if (duration <= 0) this.update(0);
  }

  /**
   * Walk cycle: swings between the walk_a and walk_b poses. `amount` is 0 (idle) to 1 (full speed).
   * Starts from the standing rest pose, so call setPose('stand') before walking.
   */
  walk(dt, amount) {
    if (this.tween) return;
    this.walkPoses ??= { a: this.resolve('walk_a'), b: this.resolve('walk_b') };
    this.walkBlend += (amount - this.walkBlend) * Math.min(1, dt * 10);
    this.walkPhase += dt * 9 * Math.max(amount, 0.35);
    const k = 0.5 + 0.5 * Math.sin(this.walkPhase);
    const q = new THREE.Quaternion();
    for (const [name, qa] of Object.entries(this.walkPoses.a.joints)) {
      q.slerpQuaternions(qa, this.walkPoses.b.joints[name], k);
      this.joints[name].quaternion.slerpQuaternions(this.rest[name], q, this.walkBlend);
    }
    this.model.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.025 * this.walkBlend;
  }

  update(dt) {
    const tw = this.tween;
    if (!tw) return;
    tw.t += dt;
    const k = tw.duration > 0 ? Math.min(tw.t / tw.duration, 1) : 1;
    const e = k * k * (3 - 2 * k);
    this.model.position.lerpVectors(tw.from.root, tw.target.root, e);
    for (const [name, q] of Object.entries(tw.target.joints)) {
      this.joints[name].quaternion.slerpQuaternions(tw.from.joints[name], q, e);
    }
    if (k >= 1) this.tween = null;
  }
}
