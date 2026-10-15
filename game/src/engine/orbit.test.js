import { describe, expect, it } from 'vitest';
import { orbitOffset, addLook, MAX_TILT, MIN_TILT } from './orbit.js';

describe('orbitOffset', () => {
  it('keeps the offset unchanged without yaw or tilt', () => {
    const v = orbitOffset([1, 2, 3], 0, 0);
    expect([v.x, v.y, v.z]).toEqual([1, 2, 3]);
  });

  it('turns the offset around the character by the yaw', () => {
    const v = orbitOffset([0, 2, 3], Math.PI / 2, 0);
    expect(v.x).toBeCloseTo(3, 5);
    expect(v.y).toBeCloseTo(2, 5);
    expect(v.z).toBeCloseTo(0, 5);
  });

  it('raises the camera with positive tilt and lowers it with negative tilt', () => {
    expect(orbitOffset([0, 2, 3], 0, 0.5).y).toBeCloseTo(3, 5);
    expect(orbitOffset([0, 2, 3], 0, -0.5).y).toBeCloseTo(1, 5);
  });

  it('keeps the horizontal distance when tilting', () => {
    const v = orbitOffset([0, 2, 3], 0.7, 0.4);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(3, 5);
  });
});

describe('addLook', () => {
  it('dragging right turns the camera to the right (yaw decreases) and dragging down tilts it up', () => {
    const next = addLook({ yaw: 0, tilt: 0 }, 100, 50);
    expect(next.yaw).toBeLessThan(0);
    expect(next.tilt).toBeGreaterThan(0);
  });

  it('clamps the tilt so the camera never goes below the floor or flips over the head', () => {
    expect(addLook({ yaw: 0, tilt: 0 }, 0, 100000).tilt).toBe(MAX_TILT);
    expect(addLook({ yaw: 0, tilt: 0 }, 0, -100000).tilt).toBe(MIN_TILT);
  });

  it('wraps nothing: yaw keeps accumulating', () => {
    let s = { yaw: 0, tilt: 0 };
    for (let i = 0; i < 100; i++) s = addLook(s, 100, 0);
    expect(s.yaw).toBeLessThan(-10);
  });
});
