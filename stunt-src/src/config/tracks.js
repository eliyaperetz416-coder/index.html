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
      { type: 'straight', length: 140 },
      { type: 'jump', rampLength: 34, angle: 17, gap: 40, drop: 5, landLength: 60 },
      { type: 'straight', length: 80 },
      { type: 'turn', angle: 70, radius: 120 },
      { type: 'straight', length: 60 },
      { type: 'drop', height: 38, angle: 50, radius: 34 },
      { type: 'straight', length: 110 },
      { type: 'loop', radius: 17 },
      { type: 'straight', length: 90 },
      { type: 'turn', angle: -50, radius: 140 },
      { type: 'hill', length: 60, angle: 12 },
      { type: 'straight', length: 70 },
      { type: 'finish', length: 120 },
    ],
  },
];

export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
