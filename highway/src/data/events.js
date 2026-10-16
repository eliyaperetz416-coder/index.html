// Timed events. Add an object here and it appears on the calendar - no logic changes needed.
//
//   schedule: { start:'YYYY-MM-DD', end:'YYYY-MM-DD' }                      one-off window (end day inclusive)
//          or { anchor:'YYYY-MM-DD', everyDays:14, durationDays:6 }         repeats forever
//   world:    world id the event is played in (optional; without it the event only applies modifiers)
//   goal:     { stat, type:'sum'|'max', target, text }  - stats: closeCalls, tightCalls, maxKmh, score, bestCombo, distanceKm
//   reward:   { coins, car }   - `car` must be a cars.js entry with event: '<this id>'
//   modifiers:{ coinMult, global } - global:true applies to every run while the event is active
export const EVENTS = [
  {
    id: 'rain_rush', name: 'Midnight Rain Rush', color: '#2ec8ff',
    blurb: 'A storm rolls over the city. Wet roads, low visibility, bigger payouts.',
    schedule: { anchor: '2026-10-12', everyDays: 14, durationDays: 6 },
    world: 'rainynight',
    goal: { stat: 'closeCalls', type: 'sum', target: 40, text: 'Get {n} close calls in the event' },
    reward: { coins: 4000, car: 'storm' },
    modifiers: { coinMult: 1.5 },
  },
  {
    id: 'tunnel_run', name: 'Tunnel Vision', color: '#ff2e9a',
    blurb: 'No sky, no escape. Thread the neon tunnel at speed.',
    schedule: { anchor: '2026-10-19', everyDays: 14, durationDays: 6 },
    world: 'tunnel',
    goal: { stat: 'score', type: 'max', target: 30000, text: 'Score {n} in one event run' },
    reward: { coins: 5000, car: 'wraith' },
    modifiers: { coinMult: 1.5 },
  },
  {
    id: 'double_weekend', name: 'Double Coins Weekend', color: '#ffb02e',
    blurb: 'Every run pays double coins, in every world.',
    schedule: { anchor: '2026-10-16', everyDays: 7, durationDays: 3 },
    modifiers: { coinMult: 2, global: true },
  },
  {
    id: 'launch_season', name: 'Launch Season', color: '#c6ff00',
    blurb: 'Celebrate the launch: drive far on Neon City and earn the Founder GT.',
    schedule: { start: '2026-10-01', end: '2027-01-31' },
    world: 'neoncity',
    goal: { stat: 'distanceKm', type: 'sum', target: 40, text: 'Drive {n} km in the event' },
    reward: { coins: 2500, car: 'founder' },
    modifiers: { coinMult: 1.25 },
  },
];
