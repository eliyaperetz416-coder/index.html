# Loop Riot (working title)

A one-finger 3D stunt racing game for the browser, installable on iPhone as a PWA.
Three.js + plain JavaScript, built with Vite. The name is a placeholder: change `GAME_NAME` in
`src/config/game.js` and the title, home-screen name and menus follow.

## Run it

```bash
cd stunt-src
npm install
npm run dev        # http://localhost:5173 (also on your LAN: open the printed Network URL on a phone)
npm test           # unit tests (track builder, physics, race)
npm run e2e        # browser smoke test: menu -> race -> finish (headless Chromium)
node tests/e2e/tracks.mjs    # track list, unlock flow (autopilot drives)
node tests/e2e/hazards.mjs   # screenshots of every hazard (hidden 'lab' track)
node tests/e2e/garage.mjs    # buy, upgrade, paint, underglow, missions, idle pop-up
node tests/e2e/boss.mjs      # boss intro, rival race, world unlock, desert screenshots
node tests/e2e/events.mjs    # events calendar, play a live event, event result
npm run e2e:pwa    # production build + offline test
npm run publish    # build into ../stunt (the folder GitHub Pages serves)
```

## Play

- **Phone:** hold anywhere to accelerate, slide your finger left/right to steer, lift to brake.
  Steer hard at speed to **drift**. Flick up (or tap with a second finger, or tap NITRO) to fire **nitro**.
- **Desktop:** W / Up / Space accelerate, A D / Left Right steer, S / Down brake, Shift / N nitro.
  The mouse works like a finger.
- Nitro fills by drifting, near misses, air time, flips and boost pads. Hits and crashes only slow you down.
- Add `?quality=low|medium|high` to the URL to force a graphics preset (high = bloom).

## Install on iPhone

1. Publish (`npm run publish`), push, and open the published URL in **Safari**
   (for this repo: `https://<user>.github.io/index.html/stunt/`).
2. Tap **Share** -> **Add to Home Screen** -> **Add**.
3. Launch it from the home screen: it runs full screen, portrait, and works offline after the first load.

## Code map

| Folder | What |
| --- | --- |
| `src/config/` | Everything that varies, as data: `game.js` (name, physics, camera, quality), `cars.js`, `tracks.js`, `worlds.js`, `hazards.js`, `upgrades.js`, `cosmetics.js`, `missions.js` |
| `src/core/` | Game loop, input, storage (localStorage), math |
| `src/track/` | `pieces.js` (track piece types) and `path.js` (centreline + frames, queries) |
| `src/physics/` | `car.js`: arcade car on the track (ground and air modes, jump assist, crashes, respawn) |
| `src/game/` | `race.js` (pure race simulation), `raceView.js` (draws it), `game.js` (menus <-> races) |
| `src/hazards/` | Track items: boost pads, coins, sawblades, wrecking balls, pillars, lasers, oil. One file per type |
| `src/game/ai.js`, `boss.js` | AI driver (reads every item's danger prediction) and boss rivals built on it |
| `src/game/progress.js` | Unlocks, medals, best times |
| `src/game/economy.js`, `missions.js` | Buying, upgrades, cosmetics, idle earnings, daily missions |
| `src/game/events.js` | Timed events: schedules, calendar, goals, rewards (content in `config/events.js`) |
| `src/render/` | Renderer (+ bloom), chase camera, track meshes, world/sky/scenery, textures, particles, **model layer** |
| `src/ui/` | HUD and screens (plain DOM) |
| `src/sw.js` | Service worker template (file list filled in at build time) |
| `tests/` | `unit/` (Vitest) and `e2e/` (Playwright scripts) |

Simulation code (track, physics, race) never touches the renderer, so it runs headless in tests.

## Add a track

Add an object to `TRACKS` in `src/config/tracks.js`. A track is a list of pieces:

```js
{
  id: 'neon-6', name: 'My Track', world: 'neon',
  difficulty: 3,              // stars on the track card
  reward: 180,                // coins for finishing (doubled the first time)
  par: [60, 68, 78],          // gold / silver / bronze times in seconds
  requires: 'neon-5',         // must finish this track first (omit = open from the start)
  origin: [0, 80, 0],         // start position (keep it high: drops need room)
  pieces: [
    { type: 'start' },
    { type: 'straight', length: 120 },
    { type: 'jump', rampLength: 34, angle: 17, gap: 40, drop: 5, landLength: 60, flips: 1 }, // flips / rolls: stunt
    { type: 'turn', angle: 70, radius: 120 },          // + right, - left; optional bank (degrees)
    { type: 'drop', height: 38, angle: 50, radius: 34 },
    { type: 'loop', radius: 17 },                      // side: -1 shifts the exit left
    { type: 'hill', length: 60, angle: 12 },           // launches the car at speed
    { type: 'climb', height: 20 },
    { type: 'finish' },
  ],
}
```

Any piece takes `width` (default 14, applies to that piece only) and `walls: false`.
All piece types are in `src/track/pieces.js`.

`npm test` builds every track, checks the road never runs into itself, and has the AI driver race
each career track (it must finish in 40-90 s without falling off and with at most 2 hits).
Use the AI times to set `par`.

## Hazards, pads and coins

Pieces carry **items**: `at` is metres from the piece start (or `t`, a 0..1 fraction of the piece),
`x` is metres from the centre line (+ right). Any default can be overridden on the item:

```js
{ type: 'straight', length: 140, items: [
  { type: 'boost', at: 120 },
  { type: 'coins', at: 20, count: 6, pattern: 'zigzag' },   // 'line' | 'zigzag' | 'arc'
  { type: 'sawblade', at: 40, sweep: 4.5, period: 2.4 },
  { type: 'wreckingBall', at: 80, swing: 60 },
  { type: 'pillar', at: 100, side: -1 },                    // falls across the road as you approach
  { type: 'laser', at: 120, lanes: 3, pattern: 'alternate' },
  { type: 'oil', at: 130, x: -3 },
  { preset: 'saw-slalom', at: 20 },                         // a named group of items
] }
```

- Defaults and presets: `src/config/hazards.js`.
- Each type lives in `src/hazards/<type>.js`: pure logic (`create`, `collide`, `danger` for the AI)
  plus a batched view, registered by name and imported in `src/hazards/index.js`.

## Add a car

Add an object to `CARS` in `src/config/cars.js`:

```js
{
  id: 'viper2', name: 'My Car', tier: 'sport', price: 6000, blurb: 'One line for the garage.',
  stats: { topSpeed: 54, accel: 19, handling: 0.75, nitro: 0.6 },   // base values
  physics: { mass: 1, grip: 7.5, twitch: 1.1, airControl: 1 },    // feel: heavy/stable vs light/twitchy
  body: { shape: 'sport', length: 4.2, width: 1.95, height: 1.2, paint: '#ff0055', spoiler: true },
}
```

Tiers (`regular`, `sport`, `luxury`, `formula`) set upgrade prices and idle earnings (`TIERS`).
Body shapes: `hatch`, `truck`, `sport`, `luxury`, `formula`, `buggy`. The body is built from simple
geometry by `src/render/models.js` (the **model layer**). To use a real 3D model later, add
`model: 'models/my-car.glb'` (file in `public/models/`, optional `modelScale`, `modelRotation`):
the model layer loads it with GLTFLoader and swaps it in for the placeholder. Name the wheel nodes
`wheel*` so they spin.

## Garage, upgrades, cosmetics, missions

- Upgrade paths (Top Speed, Acceleration, Handling, Idle Earnings), max level and costs:
  `src/config/upgrades.js`. Idle earnings pay coins per hour for every owned car while you are away,
  up to `IDLE_CAP_HOURS`; you collect them in a pop-up when you come back.
- Paints (metallic and neon), rims and underglow: `src/config/cosmetics.js`. Bought once, usable on every car.
- Daily missions: `src/config/missions.js` (three per day, same for everyone on a date).
- All logic is pure and unit tested: `src/game/economy.js`, `src/game/missions.js`.
- Everything is saved in localStorage (`src/core/storage.js`, key `stunt-racer-save`).

## Add a world

Add an object to `WORLDS` in `src/config/worlds.js`: sky (and sun), fog, lights, reflection colours,
road and wall colours, ground (`grid` or `sand`), `scenery` generator (`city`, `desert`, or register
your own with `registerScenery` in `src/render/scenery.js`), `hazardStyle` colours, `items` (hazard
default overrides for the whole world) and `requires` (the track, usually a boss, that opens it).
Then point tracks at it with `world: '<id>'`. Desert-only hazards: `boulder` and `sand`.

## Add an event

Add an object to `EVENTS` in `src/config/events.js`. An event carries everything it needs:

```js
{
  id: 'moon-jump', name: 'Moon Jump Weekend', blurb: '...', color: '#9db4ff',
  schedule: { type: 'weekly', days: [5, 6, 0] },        // or { type: 'fixed', start: '2026-10-20', end: '2026-11-02' }
  modifiers: { gravity: 0.6 },                          // gravity, nitroFill, coinValue
  goal: { type: 'time', seconds: 70 },                  // finish | time | coins | drift
  rewards: { coins: 1200, car: 'lunar' },               // paid once, while the event is live
  track: { world: 'neon', origin: [0, 80, 0], pieces: [ ... ] },   // its own course
  cars: [ { id: 'lunar', ... } ],                       // event-only cars (cannot be bought)
}
```

The calendar (Events button) shows live, upcoming and recently ended events. Event logic is in
`src/game/events.js` and unit tested; `npm test` also drives every event course and checks its goal
can be reached.

## Add a boss

A boss is a track with a `boss` block (see `neon-boss` in `src/config/tracks.js`):

```js
boss: {
  name: 'BARON VOLT', taunt: 'Nobody passes the Baron.',
  power: 1.0,        // rival speed relative to YOUR car (so any car can win with nitro, pads, clean lines)
  skill: 0.9,        // AI line quality
  aggression: 1.1,   // how hard it steers into you when close (rams shove you, then it backs off)
  rubber: { ahead: 0.94, behind: 1.12 },   // only when the race is lopsided; off in the last fifth
  glow: '#ff2b4a',
  car: { id: 'boss-volt', name: 'Volt Hammer', tier: 'luxury', stats: {...}, physics: {...}, body: {...} },
}
```

A boss track only counts as done when you win. `npm test` checks a sharp AI driver beats each boss
and a sloppy one can lose.
