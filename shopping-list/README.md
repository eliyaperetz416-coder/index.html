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
| `js/category.js`, `js/errors.js`, `js/ids.js`, `js/items.js`, `js/codes.js`, `js/html.js` | Pure logic, unit tested |
| `js/firebase.js` | Firebase init, exposed as `window.FB`; loaded on demand |
| `i18n/<lang>.js` | One dictionary per language; Hebrew is bundled, the rest load when chosen |

## Tests (dev only, nothing here is deployed)

```
npm install
npm run test:unit   # logic + translation key parity
npm run test:e2e    # Playwright against the Auth + Firestore emulators
npm run test:rules  # Firestore security rules (firestore.rules) against the emulator
```

The end-to-end tests run the real Firebase SDK against the local emulators; the
CDN requests are rerouted to a local bundle (see `tests/e2e/fixtures.mjs`).

## Data and security

- `lists/{listId}`: a shared list. Only members can read or edit it.
- `joinCodes/{code}`: points a join code at its list. Codes can be looked up one at a
  time but never listed. Joining writes `lists/{listId}/joins/{uid}` with the code and
  adds only the joiner to `members`, in one batch.
- `firestore.rules` enforces this; `firestore.rules.original` is what was live before.
- Everything in a list document was written by some member, so the app escapes all of
  it before display and derives category names and colours from `catKey` only.
