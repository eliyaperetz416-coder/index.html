import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FloorSampler } from './floor.js';

function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  const m = new THREE.Mesh(g);
  m.updateMatrixWorld(true);
  return m;
}

// A ramp rising from y 0 at z 0 to y 1.8 at z 4.
const up = quad([-1, 0, 0], [1, 0, 0], [1, 1.8, 4], [-1, 1.8, 4]);
const flipped = quad([-1, 0, 0], [-1, 1.8, 4], [1, 1.8, 4], [1, 0, 0]);

describe('FloorSampler', () => {
  it('finds the ramp height under the player', () => {
    expect(new FloorSampler([up]).heightAt(0, 2, 0.9)).toBeCloseTo(0.9, 2);
  });

  it('works whichever way the surface faces', () => {
    expect(new FloorSampler([flipped]).heightAt(0, 2, 0.9)).toBeCloseTo(0.9, 2);
  });

  it('returns null over a gap', () => {
    expect(new FloorSampler([up]).heightAt(5, 2, 0.9)).toBeNull();
  });

  it('does not snap up to a floor far above the player', () => {
    const upstairs = quad([-1, 3.6, -1], [1, 3.6, -1], [1, 3.6, 1], [-1, 3.6, 1]);
    const ground = quad([-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]);
    expect(new FloorSampler([upstairs, ground]).heightAt(0, 0, 0)).toBeCloseTo(0, 5);
  });
});
