// World configs. Lanes: dir +1 = same direction as player, -1 = oncoming. speed in m/s (constant per lane).
export const WORLDS = {
  neoncity: {
    id: 'neoncity',
    name: 'Neon City',
    sky: { top: 0x04030c, bottom: 0x2a0a4a, glow: 0xff2e9a },
    fog: { color: 0x120622, near: 60, far: 330 },
    ambient: { sky: 0x6a4cff, ground: 0x120a22, intensity: 0.9 },
    road: { color: '#16161d', line: '#e9e9f2', center: '#ffcc33', edgeGlow: 0x00e5ff, edgeGlow2: 0xff2e9a },
    lanes: [
      { dir: -1, speed: 28 }, { dir: -1, speed: 22 },
      { dir: 1, speed: 16 },  { dir: 1, speed: 22 },
    ],
    playerStartLane: 2,
    trafficDensity: 1.0,
    buildings: { palettes: [0x00e5ff, 0xff2e9a, 0xffb02e, 0x8a5cff], minH: 16, maxH: 80, gap: 20 },
    streetlights: { color: 0xffd9a0, spacing: 36 },
    rain: false,
  },
};
export const DEFAULT_WORLD = 'neoncity';
