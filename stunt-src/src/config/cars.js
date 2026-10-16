// Cars. Every car is plain data: stats, price, tier and the look of its procedural body.
// To add a car, add an object to CARS (see README).
//
// stats (base, before upgrades):
//   topSpeed  m/s on flat road with the pedal down
//   accel     m/s^2 from standstill
//   handling  0..1, how quickly and how far the car moves sideways
//   nitro     0..1, nitro strength and tank size
// physics:
//   mass      heavier = less knock-back from hits and walls, more stable
//   grip      how fast sideways speed follows the steering (low = slides, twitchy)
//   airControl how much the car can steer in the air

export const CARS = [
  {
    id: 'pebble',
    name: 'Pebble',
    tier: 'regular',
    price: 0,
    stats: { topSpeed: 44, accel: 15, handling: 0.6, nitro: 0.4 },
    physics: { mass: 1, grip: 7, airControl: 1 },
    body: { shape: 'hatch', length: 3.8, width: 1.85, height: 1.35, paint: '#ff3b6b' },
  },
];

export const CAR_BY_ID = Object.fromEntries(CARS.map((c) => [c.id, c]));

/** Stats the physics uses, after upgrades. */
export function effectiveStats(car /* , upgrades = {} */) {
  const s = car.stats;
  return {
    topSpeed: s.topSpeed,
    accel: s.accel,
    steerSpeed: 7 + s.handling * 8,
    grip: car.physics.grip * (0.75 + s.handling * 0.5),
    mass: car.physics.mass,
    airControl: car.physics.airControl,
    nitro: s.nitro,
  };
}
