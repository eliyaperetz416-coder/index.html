# Shopping list app

Static site (no build step): open `index.html` through any web server, or deploy
the folder to Firebase Hosting. Firebase Auth + Firestore, Hebrew by default,
ten languages.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Markup only |
| `css/app.css` | All styles |
| `js/app.js` | Entry point: loads the language, wires every screen |
| `js/state.js` | The shared, mutable app state |
| `js/sync.js` | Lists + Firestore: load, create, join, live subscription, save |
| `js/actions.js` | Add / tick off / delete / urgency |
| `js/render.js`, `js/stats.js` | Drawing the list, the stats screen and suggestions |
| `js/settings.js`, `js/lists-ui.js`, `js/nav.js`, `js/auth.js` | The other screens and sign-in |
| `js/category.js`, `js/errors.js`, `js/ids.js`, `js/items.js` | Pure logic, unit tested |
| `js/firebase.js` | Firebase init, exposed as `window.FB`; loaded on demand |
| `i18n/<lang>.js` | One dictionary per language; Hebrew is bundled, the rest load when chosen |

## Tests (dev only, nothing here is deployed)

```
npm install
npm run test:unit   # logic + translation key parity
npm run test:e2e    # Playwright against the Auth + Firestore emulators
```

The end-to-end tests run the real Firebase SDK against the local emulators; the
CDN requests are rerouted to a local bundle (see `tests/e2e/fixtures.mjs`).
