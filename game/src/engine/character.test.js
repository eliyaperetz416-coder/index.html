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
