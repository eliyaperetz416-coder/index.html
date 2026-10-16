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
npm run e2e:pwa    # production build + offline test
npm run publish    # build into ../stunt (the folder GitHub Pages serves)
```

## Play

- **Phone:** hold anywhere to accelerate, slide your finger left/right to steer, lift to brake.
- **Desktop:** W / Up / Space accelerate, A D / Left Right steer, S / Down brake. The mouse works like a finger.

## Install on iPhone

1. Publish (`npm run publish`), push, and open the published URL in **Safari**
   (for this repo: `https://<user>.github.io/index.html/stunt/`).
2. Tap **Share** -> **Add to Home Screen** -> **Add**.
3. Launch it from the home screen: it runs full screen, portrait, and works offline after the first load.

## Code map

| Folder | What |
| --- | --- |
| `src/config/` | Everything that varies, as data: `game.js` (name, physics, camera, quality), `cars.js`, `tracks.js`, `worlds.js` |
| `src/core/` | Game loop, input, storage (localStorage), math |
| `src/track/` | `pieces.js` (track piece types) and `path.js` (centreline + frames, queries) |
| `src/physics/` | `car.js`: arcade car on the track (ground and air modes, jump assist, crashes, respawn) |
| `src/game/` | `race.js` (pure race simulation), `raceView.js` (draws it), `game.js` (menus <-> races) |
| `src/render/` | Renderer, chase camera, track meshes, world/sky/scenery, procedural textures, **model layer** |
| `src/ui/` | HUD and screens (plain DOM) |
| `src/sw.js` | Service worker template (file list filled in at build time) |
| `tests/` | `unit/` (Vitest) and `e2e/` (Playwright scripts) |

Simulation code (track, physics, race) never touches the renderer, so it runs headless in tests.

## Add a track

Add an object to `TRACKS` in `src/config/tracks.js`. A track is a list of pieces:

```js
{
  id: 'my-track', name: 'My Track', world: 'neon', reward: 120, origin: [0, 60, 0],
  pieces: [
    { type: 'start' },
    { type: 'straight', length: 120 },
    { type: 'jump', rampLength: 34, angle: 17, gap: 40, drop: 5, landLength: 60 },
    { type: 'turn', angle: 70, radius: 120 },          // + right, - left; optional bank
    { type: 'drop', height: 38, angle: 50, radius: 34 },
    { type: 'loop', radius: 17 },
    { type: 'hill', length: 60, angle: 12 },           // launches the car at speed
    { type: 'climb', height: 20 },
    { type: 'finish' },
  ],
}
```

Any piece takes `width` (default 14) and `walls: false`. All piece types are in `src/track/pieces.js`.
`npm test` checks that every track builds.

## Add a car

Add an object to `CARS` in `src/config/cars.js` (stats, physics, body shape and paint).
The body is built from simple geometry by `src/render/models.js`. To use a real 3D model later,
add `model: 'models/my-car.glb'` (put the file in `public/models/`): the model layer loads it and
swaps it in for the placeholder.

## Add a world

Add an object to `WORLDS` in `src/config/worlds.js` (sky, fog, lights, road and wall colours,
scenery type) and set `world: '<id>'` on tracks.
