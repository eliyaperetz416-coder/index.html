// Daily mission pool. type 'sum' accumulates across runs that day, 'max' keeps the best single-run value.
// targets: [easy, medium, hard]; rewards in coins. `reach` = how to know the hard target is feasible for the player's best car.
export const MISSION_POOL = [
  { id: 'close',  stat: 'closeCalls', type: 'sum', text: 'Get {n} close calls',       targets: [10, 25, 45],         rewards: [250, 500, 900] },
  { id: 'tight',  stat: 'tightCalls', type: 'sum', text: 'Pull off {n} tight calls',  targets: [4, 10, 20],          rewards: [250, 550, 1000] },
  { id: 'speed',  stat: 'maxKmh',     type: 'max', text: 'Reach {n} km/h',            targets: [180, 240, 300],      rewards: [250, 600, 1200], feasible: 'speed' },
  { id: 'score',  stat: 'score',      type: 'max', text: 'Score {n} in one run',      targets: [10000, 25000, 50000], rewards: [250, 600, 1200] },
  { id: 'combo',  stat: 'bestCombo',  type: 'max', text: 'Reach a {n}x combo',        targets: [5, 12, 25],          rewards: [250, 500, 900] },
  { id: 'dist',   stat: 'distanceKm', type: 'sum', text: 'Drive {n} km',              targets: [3, 8, 15],           rewards: [250, 500, 900] },
];
