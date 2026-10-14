import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { footprint, resolveCollisions } from './collision.js';

const box = (minX, maxX, minY, maxY, minZ, maxZ) => ({ minX, maxX, minY, maxY, minZ, maxZ });

describe('footprint', () => {
  it('turns a scaled collider empty into a box with height', () => {
    const e = new THREE.Object3D();
    e.position.set(1, 5.2, -2);
    e.scale.set(0.5, 1.6, 0.25);
    e.updateMatrixWorld(true);
    const f = footprint(e);
    for (const [k, v] of Object.entries(box(0.5, 1.5, 3.6, 6.8, -2.25, -1.75))) expect(f[k]).toBeCloseTo(v, 6);
  });
});

describe('resolveCollisions', () => {
  it('ignores a wall on the floor above', () => {
    const p = new THREE.Vector3(0.1, 0, 0);
    resolveCollisions(p, [box(0, 1, 3.6, 6.8, -1, 1)]);
    expect(p.x).toBeCloseTo(0.1);
  });

  it('pushes the player out of a wall on the same floor', () => {
    const p = new THREE.Vector3(0.1, 0, 0);
    resolveCollisions(p, [box(0, 1, 0, 3.2, -1, 1)]);
    expect(p.x).toBeCloseTo(-0.2);
  });

  it('pushes the player out of a circle collider (an NPC)', () => {
    const p = new THREE.Vector3(0.3, 0, 0);
    resolveCollisions(p, [{ x: 0, z: 0, r: 0.25, minY: 0, maxY: 1.7 }]);
    expect(p.x).toBeCloseTo(0.45);
  });
});
