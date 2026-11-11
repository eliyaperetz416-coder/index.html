import { describe, it, expect } from 'vitest';
import { createState, tick, rates, alerts, canPlace, placeModule, summarize } from '../../src/sim/state.js';

describe('base simulation', () => {
  it('starts with a core that keeps its own crew alive', () => {
    const s = createState();
    const r = rates(s);
    expect(summarize(s).crew).toBe(4);
    expect(r.oxygen).toBeGreaterThan(0);
    expect(r.food).toBeGreaterThan(0);
    expect(r.energy).toBeGreaterThan(0);
  });

  it('never exceeds storage and never goes below zero', () => {
    const s = createState();
    for (let i = 0; i < 4000; i++) tick(s, 0.25);
    expect(s.resources.metal).toBe(200);
    expect(s.resources.energy).toBe(200);
    for (const v of Object.values(s.resources)) expect(v).toBeGreaterThanOrEqual(0);
    expect(s.resources.credits).toBeGreaterThan(200);
  });

  it('modules must connect to the base and cost resources', () => {
    const s = createState();
    expect(canPlace(s, 'solar', 3, 3).ok).toBe(false);
    expect(canPlace(s, 'solar', 0, 0).ok).toBe(false);
    expect(canPlace(s, 'core', 1, 0).ok).toBe(false);
    expect(canPlace(s, 'solar', 99, 0).ok).toBe(false);
    expect(placeModule(s, 'solar', 1, 0)).toBeTruthy();
    expect(s.resources.metal).toBe(120);
    expect(placeModule(s, 'solar', 2, 0)).toBeTruthy();
    s.resources.metal = 0;
    expect(canPlace(s, 'mine', 0, 1).reason).toMatch(/resources/);
  });

  it('slows powered modules when energy runs short', () => {
    const s = createState();
    s.resources.metal = 1000;
    placeModule(s, 'mine', 1, 0);
    placeModule(s, 'mine', -1, 0);
    placeModule(s, 'mine', 0, 1); // demand 4.5, supply 2
    s.resources.energy = 0;
    tick(s, 1);
    expect(s.status.power).toBeCloseTo(2 / 4.5);
    expect(s.resources.energy).toBeCloseTo(0);
    expect(alerts(s).join()).toMatch(/energy/i);
  });

  it('halves output when the crew has no oxygen', () => {
    const s = createState();
    s.resources.oxygen = 0;
    tick(s, 1);
    expect(s.status.life).toBe(0.5);
    expect(alerts(s).join()).toMatch(/oxygen/i);
  });

  it('too many habitats starve the base', () => {
    const s = createState();
    s.resources.metal = 1000;
    s.resources.credits = 1000;
    placeModule(s, 'habitat', 1, 0);
    placeModule(s, 'habitat', -1, 0);
    expect(rates(s).oxygen).toBeLessThan(0);
    expect(rates(s).food).toBeLessThan(0);
  });
});
