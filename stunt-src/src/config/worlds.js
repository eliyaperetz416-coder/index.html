// Worlds: the look (and hazard flavour) of a set of tracks. Colours are hex strings.
// `scenery` picks a generator in src/render/scenery.js. `items` overrides hazard defaults for
// every track in the world. `requires` is the track (usually a boss) to beat to open the world.
// To add a world, add an object here and point tracks at its id.

export const WORLDS = [
  {
    id: 'neon',
    name: 'Neon Night',
    blurb: 'A city that never sleeps, wired with lasers and saws.',
    sky: { top: '#05010f', horizon: '#3a0f6b', bottom: '#12002a', stars: true },
    fog: { color: '#1a0638', near: 120, far: 760 },
    light: { hemiSky: '#8a7cff', hemiGround: '#2a0a3a', hemi: 1.6, sun: '#ffd6f5', sunIntensity: 1.4, sunDir: [-0.4, 1, 0.3] },
    env: { base: '#0a0418', top: '#b9b0ff', left: '#ff2bd6', right: '#00e5ff', floor: '#120828' }, // reflections on metallic paint
    road: { base: '#1a1530', line: '#ffffff', edge: '#00f0ff' },
    wall: { color: '#140f28', neon: '#00f0ff', neonAlt: '#ff2bd6' },
    ground: { color: '#07020f', grid: '#ff2bd6', gridSize: 40 },
    scenery: { type: 'city', density: 1, colors: ['#00f0ff', '#ff2bd6', '#ffe94a', '#7c4dff'] },
    hazardStyle: { accent: '#ff2b4a', stone: '#2a2440', bands: '#ff2bd6' },
  },
  {
    id: 'desert',
    name: 'Dune Rush',
    blurb: 'Sunset canyons, rolling boulders and sand that grabs your wheels.',
    requires: 'neon-boss',
    sky: { top: '#2a1a5e', horizon: '#ff8a3d', bottom: '#5a2a1a', stars: false, sun: '#ffd27a' },
    fog: { color: '#e08a55', near: 140, far: 900 },
    light: { hemiSky: '#ffd0a0', hemiGround: '#7a4020', hemi: 1.5, sun: '#ffb070', sunIntensity: 2.2, sunDir: [0.6, 0.45, -0.5] },
    env: { base: '#3a1c10', top: '#ffe0b0', left: '#ff7a2a', right: '#7a3cff', floor: '#5a3018' },
    road: { base: '#3a2b28', line: '#ffe8c0', edge: '#ff8a00' },
    wall: { color: '#8a5a34', neon: '#ff8a00', neonAlt: '#00d0b0' },
    ground: { color: '#c98a50', sand: true },
    scenery: { type: 'desert', density: 1, rock: '#a8552c', sand: '#d89a5a' },
    hazardStyle: { accent: '#ff8a00', stone: '#b57a45', bands: '#00d0b0' },
    items: {
      pillar: { radius: 1.4 },
      laser: { period: 2.6 },
    },
  },
];

export const WORLD_BY_ID = Object.fromEntries(WORLDS.map((w) => [w.id, w]));
