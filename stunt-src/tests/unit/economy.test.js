import { describe, it, expect } from 'vitest';
import { defaultSave, merge, Storage } from '../../src/core/storage.js';
import {
  buyCar, selectCar, upgrade, upgradeCost, effectiveStats, idleRate, idlePending, collectIdle,
  buyCosmetic, equipCosmetic, cosmeticOwned, carLook, carState,
} from '../../src/game/economy.js';
import { CARS, CAR_BY_ID, TIERS } from '../../src/config/cars.js';
import { MAX_LEVEL, IDLE_CAP_HOURS } from '../../src/config/upgrades.js';
import { rollMissions, dailyMissions, trackMissions, claimMission, claimBonus, claimable, dayKey } from '../../src/game/missions.js';

describe('cars', () => {
  it('there are cars in all four tiers, priced in tier order, and the starter is free', () => {
    for (const t of TIERS) expect(CARS.some((c) => c.tier === t.id)).toBe(true);
    expect(CARS[0].price).toBe(0);
    const tierOf = (c) => TIERS.findIndex((t) => t.id === c.tier);
    for (let i = 1; i < CARS.length; i++) expect(tierOf(CARS[i])).toBeGreaterThanOrEqual(tierOf(CARS[i - 1]));
  });

  it('Formula is fastest and twitchiest, Luxury is heaviest', () => {
    const top = (c) => effectiveStats(c).topSpeed;
    const fastest = [...CARS].sort((a, b) => top(b) - top(a))[0];
    expect(fastest.tier).toBe('formula');
    const heaviest = [...CARS].sort((a, b) => b.physics.mass - a.physics.mass)[0];
    expect(heaviest.tier).toBe('luxury');
    const f = CARS.filter((c) => c.tier === 'formula');
    for (const c of f) expect(c.physics.twitch).toBeGreaterThan(1.3);
    for (const c of f) expect(c.physics.grip).toBeLessThan(6);
  });

  it('buying needs coins, then the car is owned and selected', () => {
    const save = defaultSave();
    const car = CAR_BY_ID.kestrel;
    expect(buyCar(save, 'kestrel')).toEqual({ ok: false, reason: 'coins' });
    save.coins = car.price + 10;
    expect(buyCar(save, 'kestrel').ok).toBe(true);
    expect(save.coins).toBe(10);
    expect(carState(save, 'kestrel').owned).toBe(true);
    expect(save.selectedCar).toBe('kestrel');
    expect(buyCar(save, 'kestrel').reason).toBe('owned');
    expect(selectCar(save, 'pebble')).toBe(true);
    expect(selectCar(save, 'zenith')).toBe(false);
  });
});

describe('upgrades', () => {
  it('cost grows per level and with the tier, and stops at the max level', () => {
    const a = upgradeCost(CAR_BY_ID.pebble, 'speed', 0);
    const b = upgradeCost(CAR_BY_ID.pebble, 'speed', 1);
    const c = upgradeCost(CAR_BY_ID.zenith, 'speed', 0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(a);
    expect(upgradeCost(CAR_BY_ID.pebble, 'speed', MAX_LEVEL)).toBe(null);
  });

  it('upgrading raises the stat and costs coins', () => {
    const save = defaultSave();
    save.coins = 100000;
    const before = effectiveStats(CAR_BY_ID.pebble, carState(save, 'pebble').up);
    for (const path of ['speed', 'accel', 'handling']) expect(upgrade(save, 'pebble', path).ok).toBe(true);
    const after = effectiveStats(CAR_BY_ID.pebble, carState(save, 'pebble').up);
    expect(after.topSpeed).toBeGreaterThan(before.topSpeed);
    expect(after.accel).toBeGreaterThan(before.accel);
    expect(after.steerSpeed).toBeGreaterThan(before.steerSpeed);
    expect(save.coins).toBeLessThan(100000);
    for (let i = 0; i < MAX_LEVEL + 3; i++) upgrade(save, 'pebble', 'speed');
    expect(carState(save, 'pebble').up.speed).toBe(MAX_LEVEL);
    expect(upgrade(save, 'pebble', 'speed').reason).toBe('max');
    expect(upgrade(save, 'zenith', 'speed').reason).toBe('not owned');
  });
});

describe('idle earnings', () => {
  it('buying an idle level first banks what the old level earned', () => {
    const save = defaultSave();
    save.coins = 1e6;
    upgrade(save, 'pebble', 'idle');
    save.idle = { last: Date.now() - 2 * 3.6e6 };
    const coins = save.coins;
    const r = upgrade(save, 'pebble', 'idle');
    expect(save.coins).toBe(coins + 2 * TIERS[0].idlePerLevel - r.cost);
    expect(Date.now() - save.idle.last).toBeLessThan(1000);
  });

  it('pays per hour for every owned car, capped', () => {
    const save = defaultSave();
    const t0 = 1_000_000_000_000;
    save.idle = { last: t0 };
    expect(idleRate(save)).toBe(0);
    save.coins = 1e6;
    upgrade(save, 'pebble', 'idle');
    upgrade(save, 'pebble', 'idle');
    save.idle = { last: t0 }; // upgrading banks idle coins and restarts the clock
    const rate = idleRate(save);
    expect(rate).toBe(2 * TIERS[0].idlePerLevel);
    expect(idlePending(save, t0 + 3.6e6).coins).toBe(rate);
    expect(idlePending(save, t0 + 100 * 3.6e6).coins).toBe(rate * IDLE_CAP_HOURS);
    const coins = save.coins;
    expect(collectIdle(save, t0 + 30e3)).toBe(0); // too soon
    expect(collectIdle(save, t0 + 2 * 3.6e6)).toBe(rate * 2);
    expect(save.coins).toBe(coins + rate * 2);
    expect(idlePending(save, t0 + 2 * 3.6e6).coins).toBe(0);
  });
});

describe('cosmetics', () => {
  it('free items are owned; paid ones need buying before equipping', () => {
    const save = defaultSave();
    expect(cosmeticOwned(save, 'rim', 'classic')).toBe(true);
    expect(equipCosmetic(save, 'pebble', 'paint', 'neon-pink')).toBe(false);
    save.coins = 5000;
    expect(buyCosmetic(save, 'paint', 'neon-pink').ok).toBe(true);
    expect(equipCosmetic(save, 'pebble', 'paint', 'neon-pink')).toBe(true);
    expect(buyCosmetic(save, 'glow', 'cyan').ok).toBe(true);
    expect(equipCosmetic(save, 'pebble', 'glow', 'cyan')).toBe(true);
    const look = carLook(save, CAR_BY_ID.pebble);
    expect(look.paint.neon).toBe(true);
    expect(look.glow).toBe('#00f0ff');
    expect(carLook(defaultSave(), CAR_BY_ID.pebble).paint.color).toBe(CAR_BY_ID.pebble.body.paint);
  });
});

describe('daily missions', () => {
  it('three different missions per day, the same for the same date', () => {
    const a = rollMissions('2026-10-16');
    const b = rollMissions('2026-10-16');
    expect(a).toEqual(b);
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
  });

  it('race stats advance missions; claiming pays once; all three pay a bonus', () => {
    const save = defaultSave();
    const day = new Date(2026, 9, 16, 12);
    const m = dailyMissions(save, day);
    const big = Object.fromEntries(m.list.map((x) => [x.stat, 999]));
    const done = trackMissions(save, big, day);
    expect(done.length).toBe(3);
    expect(claimable(save, day)).toBe(3);
    const coins = save.coins;
    const r0 = claimMission(save, 0, day);
    expect(r0).toBeGreaterThan(0);
    expect(claimMission(save, 0, day)).toBe(0);
    claimMission(save, 1, day);
    claimMission(save, 2, day);
    expect(claimBonus(save, day)).toBeGreaterThan(0);
    expect(claimBonus(save, day)).toBe(0);
    expect(save.coins).toBeGreaterThan(coins);
    // Next day: new missions.
    const next = new Date(2026, 9, 17, 9);
    expect(dailyMissions(save, next).day).toBe(dayKey(next));
    expect(dailyMissions(save, next).list.every((x) => x.progress === 0)).toBe(true);
  });
});

describe('storage', () => {
  it('saves and loads; old saves get new fields', () => {
    const mem = new Map();
    const backend = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    const st = new Storage(backend);
    st.load();
    st.data.coins = 1234;
    st.data.cars.kestrel = { owned: true, up: { speed: 2 } };
    st.flush();
    const st2 = new Storage(backend);
    const d = st2.load();
    expect(d.coins).toBe(1234);
    expect(d.cars.kestrel.up.speed).toBe(2);
    expect(d.cars.pebble.owned).toBe(true);
    expect(merge(defaultSave(), { coins: 5 }).cosmetics).toBeTruthy();
    st2.reset();
    expect(new Storage(backend).load().coins).toBe(0);
  });
});
