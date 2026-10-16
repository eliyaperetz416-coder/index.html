// Tracks are lists of pieces (see src/track/pieces.js for every piece type and its options).
// The track builder turns them into a 3D road; hazards and pickups are attached to pieces.

export const TRACKS = [
  {
    id: 'test',
    name: 'Test Track',
    world: 'neon',
    reward: 100,
    origin: [0, 60, 0],
    pieces: [
      { type: 'start', length: 50 },
      {
        type: 'straight', length: 140,
        items: [
          { type: 'coins', at: 20, count: 6, x: 0 },
          { type: 'barrier', at: 70, x: -3.5 },
          { type: 'barrier', at: 95, x: 3.5 },
          { type: 'boost', at: 125, x: 0 },
        ],
      },
      { type: 'jump', rampLength: 34, angle: 17, gap: 40, drop: 5, landLength: 60, items: [{ type: 'coins', at: 30, count: 8, spacing: 6, pattern: 'arc', height: 7 }] },
      { type: 'straight', length: 80, items: [{ type: 'coins', at: 15, count: 8, pattern: 'zigzag' }] },
      { type: 'turn', angle: 70, radius: 120 },
      { type: 'straight', length: 60, items: [{ type: 'barrier', at: 25, x: 0, width: 5 }] },
      { type: 'drop', height: 38, angle: 50, radius: 34 },
      { type: 'straight', length: 110, items: [{ type: 'boost', at: 70, x: -3 }, { type: 'boost', at: 70, x: 3 }] },
      { type: 'loop', radius: 17, items: [{ type: 'coins', t: 0.15, count: 10, spacing: 7 }] },
      { type: 'straight', length: 90 },
      { type: 'turn', angle: -50, radius: 140, items: [{ type: 'barrier', t: 0.3, x: -4 }, { type: 'barrier', t: 0.5, x: 4 }, { type: 'barrier', t: 0.7, x: -4 }] },
      { type: 'hill', length: 60, angle: 12 },
      { type: 'straight', length: 70, items: [{ type: 'boost', at: 30 }] },
      { type: 'finish', length: 120 },
    ],
  },
];

export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
