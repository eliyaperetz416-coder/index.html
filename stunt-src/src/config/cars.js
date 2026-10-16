// Cars. Every car is plain data: tier, price, stats, handling feel and the look of its body.
// To add a car, add an object to CARS (see README).
//
// stats (base, before upgrades):
//   topSpeed   m/s on flat road with the pedal down
//   accel      m/s^2 from standstill
//   handling   0..1, how quickly and how far the car moves sideways
//   nitro      0..1, nitro strength and length
// physics:
//   mass       heavier = less knock-back from hits and walls (stable), lighter = gets thrown about
//   grip       how fast sideways speed follows the steering (low = slides past the line)
//   twitch     steering sensitivity multiplier (Formula cars are twitchy)
//   airControl how much the car can steer in the air
// body: procedural model (src/render/models.js). Add `model: 'models/x.glb'` to use a real model.

export const TIERS = [
  { id: 'regular', name: 'Regular', color: '#8fd3ff', upgradeCost: 1, idlePerLevel: 20 },
  { id: 'sport', name: 'Sport', color: '#3dff9a', upgradeCost: 1.7, idlePerLevel: 35 },
  { id: 'luxury', name: 'Luxury', color: '#ffd400', upgradeCost: 2.6, idlePerLevel: 55 },
  { id: 'formula', name: 'Formula', color: '#ff2bd6', upgradeCost: 3.8, idlePerLevel: 80 },
];

export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]));

export const CARS = [
  {
    id: 'pebble',
    name: 'Pebble',
    tier: 'regular',
    price: 0,
    blurb: 'Cheap, cheerful, forgiving.',
    stats: { topSpeed: 44, accel: 15, handling: 0.6, nitro: 0.4 },
    physics: { mass: 1, grip: 7, twitch: 1, airControl: 1 },
    body: { shape: 'hatch', length: 3.8, width: 1.85, height: 1.35, paint: '#ff3b6b' },
  },
  {
    id: 'courier',
    name: 'Courier',
    tier: 'regular',
    price: 900,
    blurb: 'A tall wagon with a big nitro tank.',
    stats: { topSpeed: 46, accel: 15.5, handling: 0.55, nitro: 0.65 },
    physics: { mass: 1.1, grip: 7, twitch: 1, airControl: 0.9 },
    body: { shape: 'truck', length: 4.2, width: 1.95, height: 1.6, paint: '#3d8bff', wheelRadius: 0.42 },
  },
  {
    id: 'kestrel',
    name: 'Kestrel',
    tier: 'sport',
    price: 2600,
    blurb: 'Light and eager. Loves a drift.',
    stats: { topSpeed: 50, accel: 18, handling: 0.72, nitro: 0.5 },
    physics: { mass: 0.95, grip: 7.5, twitch: 1.05, airControl: 1.1 },
    body: { shape: 'sport', length: 4.1, width: 1.9, height: 1.2, paint: '#ffcc00' },
  },
  {
    id: 'ronin',
    name: 'Ronin',
    tier: 'sport',
    price: 5200,
    blurb: 'Big wing, sharp turn-in.',
    stats: { topSpeed: 53, accel: 19, handling: 0.8, nitro: 0.55 },
    physics: { mass: 1, grip: 8, twitch: 1.1, airControl: 1.1 },
    body: { shape: 'sport', length: 4.3, width: 1.95, height: 1.18, paint: '#7c4dff', spoiler: true },
  },
  {
    id: 'monarch',
    name: 'Monarch',
    tier: 'luxury',
    price: 9500,
    blurb: 'Heavy and planted. Shrugs off hits.',
    stats: { topSpeed: 55, accel: 16, handling: 0.7, nitro: 0.6 },
    physics: { mass: 1.6, grip: 9.5, twitch: 0.85, airControl: 0.75 },
    body: { shape: 'luxury', length: 4.8, width: 2.0, height: 1.38, paint: '#1d1d28' },
  },
  {
    id: 'sovereign',
    name: 'Sovereign',
    tier: 'luxury',
    price: 15000,
    blurb: 'A limousine with a rocket in the boot.',
    stats: { topSpeed: 58, accel: 17, handling: 0.72, nitro: 0.75 },
    physics: { mass: 1.75, grip: 10, twitch: 0.8, airControl: 0.7 },
    body: { shape: 'luxury', length: 5.1, width: 2.05, height: 1.4, paint: '#e9e4d8' },
  },
  {
    id: 'arrowhead',
    name: 'Arrowhead',
    tier: 'formula',
    price: 23000,
    blurb: 'Brutally fast. Slides if you are rough.',
    stats: { topSpeed: 63, accel: 24, handling: 0.85, nitro: 0.7 },
    physics: { mass: 0.75, grip: 5.2, twitch: 1.45, airControl: 1.35 },
    body: { shape: 'formula', length: 4.6, width: 1.95, height: 1.0, paint: '#ff5a1f' },
  },
  {
    id: 'zenith',
    name: 'Zenith',
    tier: 'formula',
    price: 36000,
    blurb: 'The fastest thing on wheels. Good luck.',
    stats: { topSpeed: 67, accel: 26, handling: 0.9, nitro: 0.85 },
    physics: { mass: 0.7, grip: 4.8, twitch: 1.6, airControl: 1.4 },
    body: { shape: 'formula', length: 4.7, width: 2.0, height: 0.98, paint: '#00e5ff' },
  },
];

export const CAR_BY_ID = Object.fromEntries(CARS.map((c) => [c.id, c]));

/** Car config by id, including cars from other lists (events register theirs). */
export function carById(id) {
  return CAR_BY_ID[id] ?? null;
}

/** Register extra cars (event cars) so the garage and races can find them. */
export function registerCars(list) {
  for (const c of list) if (!CAR_BY_ID[c.id]) CAR_BY_ID[c.id] = c;
}
