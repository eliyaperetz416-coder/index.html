// Garage economy: buying and selecting cars, upgrades, cosmetics and idle earnings.
// Pure functions over the save object (they mutate it and return what happened).

import { CARS, TIER_BY_ID, carById } from '../config/cars.js';
import { UPGRADES, UPGRADE_BY_ID, MAX_LEVEL, IDLE_CAP_HOURS, IDLE_MIN_MINUTES } from '../config/upgrades.js';
import { COSMETICS } from '../config/cosmetics.js';

const ZERO_UP = { speed: 0, accel: 0, handling: 0, idle: 0 };

/** Per-car save entry with every field filled in. */
export function carState(save, id) {
  const c = save.cars[id] ?? {};
  return {
    owned: !!c.owned,
    up: { ...ZERO_UP, ...(c.up ?? {}) },
    paint: c.paint ?? 'factory',
    rim: c.rim ?? 'classic',
    glow: c.glow ?? 'none',
  };
}

function writeCar(save, id, patch) {
  save.cars[id] = { ...carState(save, id), ...patch };
}

/** Stats the physics uses, after upgrades. */
export function effectiveStats(car, up = ZERO_UP) {
  const s = car.stats;
  const p = car.physics;
  const handling = Math.min(1.25, s.handling + (up.handling ?? 0) * UPGRADE_BY_ID.handling.perLevel);
  return {
    topSpeed: s.topSpeed * (1 + (up.speed ?? 0) * UPGRADE_BY_ID.speed.perLevel),
    accel: s.accel * (1 + (up.accel ?? 0) * UPGRADE_BY_ID.accel.perLevel),
    steerSpeed: (7 + handling * 8) * (p.twitch ?? 1),
    grip: p.grip * (0.75 + handling * 0.5),
    mass: p.mass,
    airControl: p.airControl,
    nitro: s.nitro,
    handling,
  };
}

/** 0..10 bars for the garage. */
export function statBars(car, up = ZERO_UP) {
  const e = effectiveStats(car, up);
  const bar = (v, lo, hi) => Math.max(0.5, Math.min(10, ((v - lo) / (hi - lo)) * 10));
  return {
    speed: bar(e.topSpeed, 35, 75),
    accel: bar(e.accel, 10, 32),
    handling: bar(e.handling, 0.3, 1.2),
    nitro: bar(car.stats.nitro, 0, 1),
  };
}

export function upgradeCost(car, pathId, level) {
  if (level >= MAX_LEVEL) return null;
  const u = UPGRADE_BY_ID[pathId];
  const tier = TIER_BY_ID[car.tier]?.upgradeCost ?? 1;
  return Math.round((u.base * Math.pow(u.growth, level) * tier) / 10) * 10;
}

const spend = (save, cost) => {
  if (save.coins < cost) return false;
  save.coins -= cost;
  return true;
};

export function buyCar(save, id) {
  const car = carById(id);
  if (!car) return { ok: false, reason: 'unknown' };
  if (carState(save, id).owned) return { ok: false, reason: 'owned' };
  if (car.eventOnly) return { ok: false, reason: 'event' };
  if (!spend(save, car.price)) return { ok: false, reason: 'coins' };
  writeCar(save, id, { owned: true });
  save.selectedCar = id;
  return { ok: true };
}

/** Give a car for free (event rewards). */
export function grantCar(save, id) {
  if (carState(save, id).owned) return false;
  writeCar(save, id, { owned: true });
  return true;
}

export function selectCar(save, id) {
  if (!carState(save, id).owned) return false;
  save.selectedCar = id;
  return true;
}

export function upgrade(save, carId, pathId) {
  const car = carById(carId);
  const st = carState(save, carId);
  if (!car || !st.owned) return { ok: false, reason: 'not owned' };
  const level = st.up[pathId];
  const cost = upgradeCost(car, pathId, level);
  if (cost == null) return { ok: false, reason: 'max' };
  if (save.coins < cost) return { ok: false, reason: 'coins', cost };
  // Bank idle coins at the old rate first, so a new level never pays for time already gone.
  if (pathId === 'idle') collectIdle(save, Date.now(), { force: true });
  spend(save, cost);
  writeCar(save, carId, { up: { ...st.up, [pathId]: level + 1 } });
  return { ok: true, cost, level: level + 1 };
}

// --- idle earnings ---------------------------------------------------------------------------

/** Coins per hour from every owned car's Idle Earnings level. */
export function idleRate(save) {
  let rate = 0;
  for (const id of Object.keys(save.cars)) {
    const car = carById(id);
    const st = carState(save, id);
    if (car && st.owned) rate += st.up.idle * (TIER_BY_ID[car.tier]?.idlePerLevel ?? 0);
  }
  return rate;
}

/** Coins waiting since the last collection (capped). */
export function idlePending(save, now = Date.now()) {
  const last = save.idle?.last ?? now;
  const hours = Math.max(0, Math.min(IDLE_CAP_HOURS, (now - last) / 3.6e6));
  return { coins: Math.floor(hours * idleRate(save)), hours, capped: hours >= IDLE_CAP_HOURS, minutes: (now - last) / 6e4 };
}

/** Collect pending idle coins. Returns the amount (0 if too soon or nothing earned). */
export function collectIdle(save, now = Date.now(), { force = false } = {}) {
  const p = idlePending(save, now);
  if (!force && p.minutes < IDLE_MIN_MINUTES) return 0;
  save.idle = { last: now };
  save.coins += p.coins;
  return p.coins;
}

// --- cosmetics ------------------------------------------------------------------------------

export function cosmeticOwned(save, kind, id) {
  const item = COSMETICS[kind].find((c) => c.id === id);
  return !!item && (item.price === 0 || (save.cosmetics?.[kind] ?? []).includes(id));
}

export function buyCosmetic(save, kind, id) {
  const item = COSMETICS[kind].find((c) => c.id === id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (cosmeticOwned(save, kind, id)) return { ok: false, reason: 'owned' };
  if (!spend(save, item.price)) return { ok: false, reason: 'coins' };
  save.cosmetics ??= {};
  save.cosmetics[kind] = [...(save.cosmetics[kind] ?? []), id];
  return { ok: true };
}

export function equipCosmetic(save, carId, kind, id) {
  if (!cosmeticOwned(save, kind, id) || !carState(save, carId).owned) return false;
  writeCar(save, carId, { [kind]: id });
  return true;
}

/** What the model builder needs to dress a car: { paint, rim, glow }. */
export function carLook(save, car, override = {}) {
  const st = { ...carState(save, car.id), ...override };
  const paintItem = COSMETICS.paint.find((p) => p.id === st.paint);
  const paint = !paintItem || paintItem.factory ? { color: car.body.paint, metal: 0.4, rough: 0.3 } : paintItem.paint;
  const rim = (COSMETICS.rim.find((r) => r.id === st.rim) ?? COSMETICS.rim[0]).rim;
  const glow = (COSMETICS.glow.find((g) => g.id === st.glow) ?? COSMETICS.glow[0]).glow;
  return { paint, rim, glow };
}

export { CARS, UPGRADES, MAX_LEVEL };
