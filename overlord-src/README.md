# Space Overlord

3D space management game. Three.js + Vite, same setup as `stunt-src/`.

```
npm install
npm run dev       # play locally with live reload
npm test          # unit tests for the game rules
npm run publish   # build into ../overlord (the folder the website serves)
```

- `src/data/` — numbers and names (resources, modules). Balance the game here.
- `src/sim/` — the rules. No 3D, no HTML, fully unit-tested.
- `src/render/` — the 3D picture of the state.
- `src/ui/` — the HUD.

## How a term plays

You are the commander, walking around a moon base in third person. A term lasts
15 minutes. Your suit holds about 2½ minutes of air outside; it refills when you
step through the airlock into any pressurised room.

- **Walk** W A S D (Shift to run, Space to jump), drag the mouse to look, wheel to zoom.
- **Build** press B outside, pick a module (1–7), look at a marked site, press E.
- **Consoles** walk up to a console in the Command module (star map, fleet, war room)
  or the Shipyard and press E.
- **Lamp** F. **Sound** M. On a phone: left thumb walks, right thumb looks, buttons for the rest.

When the timer runs out you get a score and a title, then the next term starts from scratch.

## Code map

- `src/sim/` the rules (no 3D), unit-tested: `npm test`
- `src/world/` terrain, sky, procedural textures, materials
- `src/base/` floor plan (`layout.js`), module/ship models, the base and fleet in the scene
- `src/player/` the astronaut and the third-person camera
- `src/engine/` renderer and post-processing, input, synthesised sound, modelling kit
- `src/ui/` everything drawn over the 3D view

Everything is made in code: no image, model or sound files. Tuning lives in `src/data/`.
