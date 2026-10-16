// Player cars. Add an entry here and it shows up in the garage - no logic changes needed.
// speeds in km/h; accel = km/h gained per second near zero; handling 0..1; combo = score multiplier gain per close call.
export const TIERS = [
  { id: 'regular', name: 'Regular' },
  { id: 'sport',   name: 'Sport' },
  { id: 'luxury',  name: 'Luxury' },
  { id: 'formula', name: 'Formula' },
];

export const CARS = [
  { id: 'hatch',   name: 'Street Hatch', tier: 'regular', price: 0,
    topSpeed: 230, accel: 22, handling: 0.60, comboMult: 1.0, nitro: 0.9,
    model: { type: 'car', body: 'sedan', color: 0x2f9bff, length: 4.2, width: 1.8, height: 1.35 } },
  { id: 'coupe',   name: 'Night Coupe', tier: 'regular', price: 2500,
    topSpeed: 245, accel: 24, handling: 0.64, comboMult: 1.05, nitro: 1.0,
    model: { type: 'car', body: 'sedan', color: 0xe8e8f0, length: 4.4, width: 1.82, height: 1.3 } },
  { id: 'gt',      name: 'Apex GT', tier: 'sport', price: 12000,
    topSpeed: 290, accel: 30, handling: 0.74, comboMult: 1.15, nitro: 1.2,
    model: { type: 'car', body: 'sport', color: 0xff2e63, length: 4.5, width: 1.9, height: 1.15 } },
  { id: 'viper',   name: 'Volt Racer', tier: 'sport', price: 24000,
    topSpeed: 320, accel: 34, handling: 0.70, comboMult: 1.2, nitro: 1.3,
    model: { type: 'car', body: 'sport', color: 0xc6ff00, length: 4.6, width: 1.95, height: 1.1 } },
  { id: 'sovereign', name: 'Sovereign', tier: 'luxury', price: 40000,
    topSpeed: 300, accel: 20, handling: 0.50, comboMult: 1.5, nitro: 1.0, weight: 1.6,
    model: { type: 'car', body: 'limo', color: 0x16161c, length: 5.2, width: 1.95, height: 1.4 } },
  { id: 'emperor', name: 'Emperor LX', tier: 'luxury', price: 75000,
    topSpeed: 330, accel: 24, handling: 0.55, comboMult: 1.75, nitro: 1.1, weight: 1.7,
    model: { type: 'car', body: 'limo', color: 0xd4af37, length: 5.3, width: 2.0, height: 1.4 } },
  { id: 'f1',      name: 'Comet F', tier: 'formula', price: 120000,
    topSpeed: 380, accel: 46, handling: 0.40, comboMult: 1.4, nitro: 1.6, twitchy: true,
    model: { type: 'car', body: 'formula', color: 0xff7a00, length: 4.9, width: 1.9, height: 0.95 } },
];

export const carById = (id) => CARS.find((c) => c.id === id);

// Used by the garage to draw stat bars (min..max maps to 0..100%)
export const STAT_RANGE = {
  topSpeed: [200, 420], accel: [15, 52], handling: [0.3, 1.0], comboMult: [1.0, 2.2], nitro: [0.8, 2.0],
};

// Event-only cars: no price, unlocked by completing the event named in `event` (see data/events.js).
CARS.push(
  { id: 'storm', name: 'Storm Chaser', tier: 'sport', price: 0, event: 'rain_rush',
    topSpeed: 335, accel: 33, handling: 0.78, comboMult: 1.35, nitro: 1.4,
    model: { type: 'car', body: 'sport', color: 0x1fd1ff, length: 4.5, width: 1.9, height: 1.12 } },
  { id: 'wraith', name: 'Tunnel Wraith', tier: 'luxury', price: 0, event: 'tunnel_run',
    topSpeed: 345, accel: 27, handling: 0.6, comboMult: 2.0, nitro: 1.2, weight: 1.5,
    model: { type: 'car', body: 'limo', color: 0x7a2cff, length: 5.1, width: 1.95, height: 1.32 } },
  { id: 'founder', name: 'Founder GT', tier: 'sport', price: 0, event: 'launch_season',
    topSpeed: 310, accel: 31, handling: 0.72, comboMult: 1.3, nitro: 1.3,
    model: { type: 'car', body: 'sport', color: 0xffc83d, length: 4.5, width: 1.9, height: 1.14 } },
);
