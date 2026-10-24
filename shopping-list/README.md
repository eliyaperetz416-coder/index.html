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
| `js/sync.js` | Lists + Firestore: live listeners, item writes, create / join, migration |
| `js/model.js` | Data model v2 and the v1 -> v2 migration plan (pure, unit tested) |
| `js/connection.js` | The quiet "offline" notice |
| `js/actions.js`, `js/undo.js` | Add / tick off / delete / clear bought, and the Undo toast |
| `js/autocomplete.js`, `js/suggest.js` | The add box with suggestions from past purchases |
| `js/item-edit.js` | The edit sheet (name, quantity, note, category, urgency) |
| `js/swipe.js`, `js/gestures.js` | Swipe to tick / delete (logic is pure and tested) |
| `js/shopping.js` | Shopping mode (grouped, big rows, screen kept awake) |
| `js/list-manage.js`, `js/confirm.js` | List settings: rename, code, members, leave, delete; invitation link |
| `js/templates.js`, `js/templates-ui.js` | Ready-made and saved templates |
| `js/stats-calc.js` | The numbers of the stats screen (week / month, most bought) |
| `js/render.js`, `js/stats.js` | Drawing the list, the stats screen and suggestions |
| `js/settings.js`, `js/lists-ui.js`, `js/nav.js`, `js/auth.js` | The other screens and sign-in |
| `js/category.js`, `js/errors.js`, `js/ids.js`, `js/codes.js`, `js/html.js` | Pure logic, unit tested |
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

- `lists/{listId}`: a shared list (name, code, owner, members). Only members can read or edit it.
- `lists/{listId}/items/{itemId}`: one document per item, so two people editing at once
  never overwrite each other.
- `lists/{listId}/history/{YYYY-MM}`: the purchases of one month (UTC), appended with
  `arrayUnion`; un-ticking removes the same entry, which is also kept on the item.
- Version-1 lists (arrays on the list document) are copied into the above by the first
  member who opens them, then marked `schemaVersion: 2`; the old arrays stay as a
  read-only backup. A second, simultaneous migration is refused by the rules.
- `lists/{listId}/templates/{id}`: the list's saved templates (`name`, `items`).
- Each member publishes their own display name in the list's `memberNames` map (the rules
  let nobody write anyone else's); it is only used to show who is in the list.
- Firestore keeps a copy on the device (IndexedDB), so an open app keeps working offline
  and syncs when the connection returns.
- `joinCodes/{code}`: points a join code at its list. Codes can be looked up one at a
  time but never listed. Joining writes `lists/{listId}/joins/{uid}` with the code and
  adds only the joiner to `members`, in one batch.
- `firestore.rules` enforces this; `firestore.rules.original` is what was live before.
- Everything in a list document was written by some member, so the app escapes all of
  it before display and derives category names and colours from `catKey` only.
