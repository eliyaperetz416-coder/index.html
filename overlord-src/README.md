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

A term lasts 15 minutes. Build up the base, build ships in **Fleet**, send them
to planets from the **Star Map**, answer events on the way, and join battles in
the **War** panel. When the timer runs out you get a score and a title, and the
score goes into the high-score table. Then the next term starts from scratch.

Tuning lives in `src/data/`: `term.js` (length, points, titles), `war.js`,
`events.js`, `planets.js`, `ships.js`, `modules.js`, `resources.js`.
