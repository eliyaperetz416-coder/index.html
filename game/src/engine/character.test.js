import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { poseToLocal } from './character.js';

const q = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

describe('poseToLocal', () => {
  it('returns the character-space rotation unchanged for a bone at rest identity', () => {
    const rot = q(0.3, -0.2, 0.5);
    const local = poseToLocal(new THREE.Quaternion(), new THREE.Quaternion(), rot);
    expect(local.angleTo(rot)).toBeLessThan(1e-6);
  });

  it('applies a character-space X rotation around the joint for a bone rotated 90 degrees about Z at rest', () => {
    const rest = q(0, 0, Math.PI / 2);
    const local = poseToLocal(rest, rest.clone(), q(Math.PI / 2, 0, 0));
    // Root-parented bone: world = local. Its local Z axis (world +Z at rest) must now point to world -Y.
    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(local);
    expect(z.x).toBeCloseTo(0, 5);
    expect(z.y).toBeCloseTo(-1, 5);
    expect(z.z).toBeCloseTo(0, 5);
  });
});

import { Character } from './character.js';

/** Minimal skeleton with the bones the idle motions use. */
function makeRig() {
  const root = new THREE.Group();
  const bone = (name, parent, y) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.y = y;
    (parent ?? root).add(b);
    return b;
  };
  const hips = bone('Hips', null, 0.95);
  const spine = bone('Spine', hips, 0.17);
  const chest = bone('Chest', spine, 0.2);
  const neck = bone('Neck', chest, 0.14);
  bone('Head', neck, 0.1);
  for (const s of ['L', 'R']) {
    const sh = bone(`Shoulder${s}`, chest, 0.12);
    const up = bone(`UpperArm${s}`, sh, 0.0);
    const low = bone(`LowerArm${s}`, up, -0.27);
    bone(`Hand${s}`, low, -0.25);
    const leg = bone(`UpperLeg${s}`, hips, -0.02);
    const shin = bone(`LowerLeg${s}`, leg, -0.42);
    bone(`Foot${s}`, shin, -0.42);
  }
  root.updateMatrixWorld(true);
  return root;
}

const DEG = 180 / Math.PI;
function maxDeviation(character, base, skip = []) {
  let max = 0;
  for (const [name, joint] of Object.entries(character.joints)) {
    if (skip.includes(name)) continue;
    max = Math.max(max, joint.quaternion.angleTo(base[name]) * DEG);
  }
  return max;
}

describe('Character idle motion', () => {
  const run = (kind) => {
    const c = new Character(makeRig());
    c.setPose('stand');
    const base = c.resolve('stand').joints;
    c.setIdle(kind);
    let max = 0;
    for (let i = 0; i < 30 * 30; i++) {
      c.update(1 / 30);
      max = Math.max(max, maxDeviation(c, base));
    }
    return { c, base, max };
  };

  for (const kind of ['breath', 'write', 'talk']) {
    it(`keeps '${kind}' within 8 degrees of the pose over 30 s, and actually moves`, () => {
      const { max } = run(kind);
      expect(max).toBeLessThanOrEqual(8);
      expect(max).toBeGreaterThan(0.3);
    });
  }

  it("lets 'look' turn the head up to 25 degrees, other joints stay within 8", () => {
    const c = new Character(makeRig());
    c.setPose('stand');
    const base = c.resolve('stand').joints;
    c.setIdle('look');
    let head = 0;
    let others = 0;
    for (let i = 0; i < 30 * 30; i++) {
      c.update(1 / 30);
      head = Math.max(head, c.joints.Head.quaternion.angleTo(base.Head) * DEG);
      others = Math.max(others, maxDeviation(c, base, ['Head']));
    }
    expect(head).toBeLessThanOrEqual(25);
    expect(head).toBeGreaterThan(5);
    expect(others).toBeLessThanOrEqual(8);
  });

  it('returns to the pose (except breathing) within 0.5 s after setIdle(null)', () => {
    const { c, base } = run('talk');
    c.setIdle(null);
    for (let i = 0; i < 15; i++) c.update(1 / 30);
    expect(maxDeviation(c, base, ['Chest', 'Spine', 'ShoulderL', 'ShoulderR'])).toBeLessThan(0.6);
  });
});
