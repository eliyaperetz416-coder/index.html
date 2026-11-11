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

import { step } from '../../src/sim/game.js';
import { queueShip, canQueueShip, upgradeShip, canUpgradeShip, shipStats, fleetRank, fleetCap } from '../../src/sim/fleet.js';

function richBase() {
  const s = createState();
  s.resources.metal = 200;
  s.resources.credits = 5000;
  placeModule(s, 'storage', -1, 0);
  placeModule(s, 'storage', 0, -1);
  s.resources.metal = 700;
  return s;
}

describe('fleet', () => {
  it('needs a shipyard before any ship can be built', () => {
    const s = richBase();
    expect(canQueueShip(s, 'scout').reason).toMatch(/Shipyard/);
    expect(queueShip(s, 'scout')).toBe(false);
  });

  it('builds a queued ship after its build time', () => {
    const s = richBase();
    placeModule(s, 'shipyard', 1, 0);
    s.resources.energy = 200;
    const metal = s.resources.metal;
    expect(queueShip(s, 'scout')).toBe(true);
    expect(s.resources.metal).toBe(metal - 80);
    let launched = null;
    for (let i = 0; i < 4 * 19; i++) launched = launched ?? step(s, 0.25).launched;
    expect(s.ships.length).toBe(0);
    for (let i = 0; i < 8; i++) launched = launched ?? step(s, 0.25).launched;
    expect(launched?.type).toBe('scout');
    expect(s.ships).toHaveLength(1);
    expect(s.queue).toHaveLength(0);
    expect(fleetRank(s)).toBe(1);
  });

  it('limits the queue and the fleet size', () => {
    const s = richBase();
    placeModule(s, 'shipyard', 1, 0);
    s.resources.metal = 100000;
    expect(fleetCap(s)).toBe(4);
    for (let i = 0; i < 3; i++) expect(queueShip(s, 'scout')).toBe(true);
    expect(canQueueShip(s, 'scout').reason).toMatch(/queue/i);
    s.ships.push({ id: 90, type: 'scout', level: 1 });
    s.queue.length = 2;
    expect(queueShip(s, 'scout')).toBe(true);
    s.queue.length = 0;
    s.ships.push({ id: 91, type: 'scout', level: 1 }, { id: 92, type: 'scout', level: 1 }, { id: 93, type: 'scout', level: 1 });
    expect(canQueueShip(s, 'scout').reason).toMatch(/full/i);
  });

  it('upgrades raise stats and rank, cost more each level, and stop at level 3', () => {
    const s = richBase();
    placeModule(s, 'shipyard', 1, 0);
    s.resources.metal = 700;
    s.ships.push({ id: 50, type: 'frigate', level: 1 });
    expect(shipStats(s.ships[0])).toEqual({ cargo: 12, attack: 8, hull: 60 });
    expect(upgradeShip(s, 50)).toBe(true);
    expect(s.resources.metal).toBe(540);
    expect(shipStats(s.ships[0])).toEqual({ cargo: 18, attack: 12, hull: 90 });
    expect(upgradeShip(s, 50)).toBe(true);
    expect(s.resources.metal).toBe(220);
    expect(fleetRank(s)).toBe(3);
    expect(canUpgradeShip(s, 50).reason).toMatch(/max/i);
  });
});

import { canLaunch, launchExpedition, recallExpedition, expeditionCost } from '../../src/sim/expedition.js';

function fleetBase() {
  const s = richBase();
  placeModule(s, 'shipyard', 1, 0);
  s.resources = { metal: 700, energy: 700, oxygen: 700, food: 700, credits: 5000 };
  s.ships.push({ id: 50, type: 'scout', level: 1 }, { id: 51, type: 'frigate', level: 2 });
  return s;
}

/** Run the game until an expedition event of this type happens (or give up after `seconds`). */
function runUntil(s, type, seconds = 400) {
  for (let i = 0; i < seconds * 4; i++) {
    const event = step(s, 0.25).expedition;
    if (event?.type === type) return event;
  }
  return null;
}

describe('expeditions', () => {
  it('checks ships, rank and supplies before launch', () => {
    const s = fleetBase();
    expect(canLaunch(s, 'kessa', []).reason).toMatch(/ship/);
    expect(canLaunch(s, 'kessa', [999]).ok).toBe(false);
    expect(canLaunch(s, 'vorn', [50]).reason).toMatch(/level 2/);
    expect(canLaunch(s, 'vorn', [50, 51]).ok).toBe(true);
    expect(canLaunch(s, 'nyx', [50, 51]).reason).toMatch(/level 3/);
    s.resources.oxygen = 10;
    expect(canLaunch(s, 'kessa', [50]).reason).toMatch(/supplies/);
  });

  it('takes supplies per ship and allows only one expedition at a time', () => {
    const s = fleetBase();
    expect(expeditionCost('kessa', 2)).toEqual({ energy: 60, oxygen: 30, food: 30 });
    expect(launchExpedition(s, 'kessa', [50, 51])).toBe(true);
    expect(s.resources.oxygen).toBe(670);
    expect(canLaunch(s, 'kessa', [50]).reason).toMatch(/already/);
    expect(canUpgradeShip(s, 51).reason).toMatch(/away/);
  });

  it('flies out, gathers, and brings the rare loot home', () => {
    const s = fleetBase();
    launchExpedition(s, 'kessa', [50]); // scout: cargo 30
    expect(runUntil(s, 'arrived')).toBeTruthy();
    expect(s.time).toBeCloseTo(20, 0);
    expect(runUntil(s, 'leaving')).toBeTruthy(); // hold fills (30 at 0.8/s) before the 45s stay ends
    expect(s.time).toBeLessThan(20 + 45);
    const home = runUntil(s, 'returned');
    expect(home.loot).toEqual({ lightMetal: 15, bioMatter: 15 });
    expect(s.rare.lightMetal).toBe(15);
    expect(s.rare.bioMatter).toBe(15);
    expect(s.expedition).toBe(null);
  });

  it('leaves when the stay is over even if the hold is not full', () => {
    const s = fleetBase();
    s.ships.push({ id: 52, type: 'scout', level: 3 }); // cargo 60, more than 45s × 0.8
    launchExpedition(s, 'kessa', [52]);
    const home = runUntil(s, 'returned');
    expect(home.loot.lightMetal + home.loot.bioMatter).toBe(36);
    expect(s.time).toBeCloseTo(20 + 45 + 20, 0);
  });

  it('recall turns the fleet around', () => {
    const s = fleetBase();
    launchExpedition(s, 'kessa', [50]);
    for (let i = 0; i < 20; i++) step(s, 0.25); // 5s out
    expect(recallExpedition(s)).toBe(true);
    expect(s.expedition.remaining).toBeCloseTo(5);
    expect(recallExpedition(s)).toBe(false);
    const home = runUntil(s, 'returned');
    expect(home.loot).toEqual({});
  });
});
