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
