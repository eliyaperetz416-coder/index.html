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
    rain: false, wet: false, coinBonus: 1.0, structure: 'city',
  },

  // Rainy night: wet road with light streaks, falling rain, distant lightning, tighter visibility.
  rainynight: {
    id: 'rainynight',
    name: 'Rainy Night',
    structure: 'city',
    sky: { top: 0x03060d, bottom: 0x10243a, glow: 0x2a5a7a },
    fog: { color: 0x0a1624, near: 30, far: 230 },
    ambient: { sky: 0x4a7aa8, ground: 0x0a1018, intensity: 0.85 },
    road: { color: '#0e1218', line: '#cfd8e6', center: '#e8b84a', edgeGlow: 0xff7a2e, edgeGlow2: 0x2ec8ff },
    lanes: [
      { dir: -1, speed: 26 }, { dir: -1, speed: 21 },
      { dir: 1, speed: 15 },  { dir: 1, speed: 21 },
    ],
    playerStartLane: 2,
    trafficDensity: 1.1,
    buildings: { palettes: [0xff7a2e, 0x2ec8ff, 0xffd34a, 0x6aa8ff], minH: 14, maxH: 64, gap: 20 },
    streetlights: { color: 0xffc070, spacing: 32 },
    rain: { count: 420, color: 0xaec8ff, speed: 34 },
    wet: true, lightning: true, coinBonus: 1.2,
  },

  // Tunnel: enclosed, orange sodium lights and cyan wall strips. No sky, no buildings.
  tunnel: {
    id: 'tunnel',
    name: 'Neon Tunnel',
    structure: 'tunnel',
    sky: { top: 0x050308, bottom: 0x0a0610, glow: 0x1a0a22 },
    fog: { color: 0x07040c, near: 25, far: 260 },
    ambient: { sky: 0xff9a4a, ground: 0x120808, intensity: 0.7 },
    road: { color: '#15131a', line: '#e9e9f2', center: '#ffcc33', edgeGlow: 0x00e5ff, edgeGlow2: 0xff2e9a },
    lanes: [
      { dir: -1, speed: 29 }, { dir: -1, speed: 23 },
      { dir: 1, speed: 17 },  { dir: 1, speed: 23 },
    ],
    playerStartLane: 3,
    trafficDensity: 1.15,
    tunnel: { light: 0xffa24a, strip1: 0x00e5ff, strip2: 0xff2e9a, ribSpacing: 18, lightSpacing: 9 },
    streetlights: null,
    rain: false, wet: false, coinBonus: 1.3,
  },
};
export const DEFAULT_WORLD = 'neoncity';
