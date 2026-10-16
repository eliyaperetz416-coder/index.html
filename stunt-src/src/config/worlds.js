// Worlds: the look of a set of tracks. Colours are hex strings. `scenery` picks a generator in
// src/render/scenery.js. To add a world, add an object here and point tracks at its id.

export const WORLDS = [
  {
    id: 'neon',
    name: 'Neon Night',
    sky: { top: '#05010f', horizon: '#3a0f6b', bottom: '#12002a', stars: true },
    fog: { color: '#1a0638', near: 120, far: 760 },
    light: { hemiSky: '#8a7cff', hemiGround: '#2a0a3a', hemi: 1.6, sun: '#ffd6f5', sunIntensity: 1.4, sunDir: [-0.4, 1, 0.3] },
    env: { base: '#0a0418', top: '#b9b0ff', left: '#ff2bd6', right: '#00e5ff', floor: '#120828' }, // reflections on metallic paint
    road: { base: '#1a1530', line: '#ffffff', edge: '#00f0ff' },
    wall: { color: '#140f28', neon: '#00f0ff', neonAlt: '#ff2bd6' },
    ground: { color: '#07020f', grid: '#ff2bd6', gridSize: 40 },
    scenery: { type: 'city', density: 1, colors: ['#00f0ff', '#ff2bd6', '#ffe94a', '#7c4dff'] },
  },
];

export const WORLD_BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w]));
