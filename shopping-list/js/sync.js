// Lists and their Firestore sync (schema version 2, see model.js): watching "my lists",
// creating / joining / switching, live listeners on the active list, item writes, and
// migrating version-1 lists.
//
// Every write goes to the local cache first and shows up immediately through the
// listeners, also offline; it reaches the server when there is a connection.
import { state } from './state.js';
import { t } from './i18n.js';
import { $ } from './util.js';
import { showToast, messageFor } from './ui.js';
import { render, updateHeaderForList } from './render.js';
import { renderStats } from './stats.js';
import { generateJoinCode, normalizeJoinCode, isValidJoinCode } from './codes.js';
import {
  SCHEMA_VERSION, planMigration, historyStartKey, flattenHistory, sortItems,
  isStaleBought, purchaseEntry, monthKey,
} from './model.js';

const appRoot = $('appRoot');
const FB = () => window.FB;
const listRef = (listId) => FB().doc(FB().db, 'lists', listId);
const itemRef = (listId, itemId) => FB().doc(FB().db, 'lists', listId, 'items', itemId);
const bucketRef = (listId, month) => FB().doc(FB().db, 'lists', listId, 'history', month);

function reportWriteError(err) {
  console.error('Write failed:', err);
  showToast([t().errSaveFailed, messageFor(err)].filter(Boolean).join(' · '));
}

// Writes resolve only when the server confirms (much later when offline), so the UI
// never waits for them; failures are reported when they happen.
function write(promise) {
  promise.catch(reportWriteError);
}

// ============================================================
// ITEM WRITES
// ============================================================
export function addItemDoc({ id, name, catKey }) {
  write(FB().setDoc(itemRef(state.activeListId, id), {
    name, catKey, bought: false, boughtAt: null, createdAt: Date.now(), createdBy: state.user.uid,
  }));
}

// Ticking records the purchase in this month's history bucket and keeps a copy on the
// item, so un-ticking removes exactly that entry again.
export function setBought(item, bought) {
  const listId = state.activeListId;
  const batch = FB().writeBatch(FB().db);
  if (bought) {
    const now = Date.now();
    const entry = purchaseEntry(item, now);
    batch.update(itemRef(listId, item.id), { bought: true, boughtAt: now, purchase: entry });
    batch.set(bucketRef(listId, monthKey(now)), { entries: FB().arrayUnion(entry) }, { merge: true });
  } else {
    batch.update(itemRef(listId, item.id), { bought: false, boughtAt: null, purchase: FB().deleteField() });
    if (item.purchase) {
      batch.set(bucketRef(listId, monthKey(item.purchase.timestamp)), { entries: FB().arrayRemove(item.purchase) }, { merge: true });
    }
  }
  write(batch.commit());
}

export function setUrgencyDoc(itemId, urgency) {
  write(FB().updateDoc(itemRef(state.activeListId, itemId), { urgency }));
}

export function deleteItemDoc(itemId) {
  write(FB().deleteDoc(itemRef(state.activeListId, itemId)));
}

// Items ticked off before today's midnight are removed — a bought item stays visible
// for the rest of the day it was checked off, then quietly clears itself. Any member's
// app may do this; deleting twice is harmless. Returns true if anything was removed.
export function cleanupStaleBoughtItems() {
  const stale = state.items.filter((i) => isStaleBought(i));
  if (stale.length === 0 || !state.activeListId) return false;
  state.items = state.items.filter((i) => !isStaleBought(i));
  const batch = FB().writeBatch(FB().db);
  stale.forEach((i) => batch.delete(itemRef(state.activeListId, i.id)));
  write(batch.commit());
  return true;
}

// ============================================================
// MIGRATION: version 1 (arrays on the list document) -> version 2
// ============================================================
const migrating = new Set();
const BATCH_LIMIT = 450;

async function migrateList(listId, data) {
  if (migrating.has(listId)) return;
  migrating.add(listId);
  const { items, buckets } = planMigration(data);
  const uid = state.user.uid;
  const ops = [
    ...items.map(({ id, data: item }) => (b) => b.set(itemRef(listId, id), { ...item, createdBy: uid })),
    ...Object.entries(buckets).map(([month, entries]) => (b) => b.set(bucketRef(listId, month), { entries: FB().arrayUnion(...entries) }, { merge: true })),
  ];
  const chunks = [];
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) chunks.push(ops.slice(i, i + BATCH_LIMIT));
  if (chunks.length === 0) chunks.push([]);
  try {
    for (let c = 0; c < chunks.length; c++) {
      const batch = FB().writeBatch(FB().db);
      chunks[c].forEach((op) => op(batch));
      // The flag rides in the last batch. If another member's app migrated first, the
      // rules refuse it — and with it this batch — so nothing is written twice.
      if (c === chunks.length - 1) batch.update(listRef(listId), { schemaVersion: SCHEMA_VERSION, migratedAt: FB().serverTimestamp() });
      await batch.commit();
    }
  } catch (err) {
    if (err.code !== 'permission-denied') {
      console.error('Migrating list failed (will retry):', listId, err);
      migrating.delete(listId);
    }
  }
}

// ============================================================
// THE ACTIVE LIST: three live listeners
// ============================================================
let activeUnsubs = [];
let subscribedListId = null;

function stopActiveList() {
  activeUnsubs.forEach((unsub) => unsub());
  activeUnsubs = [];
  subscribedListId = null;
}

function onListError(listId, err) {
  if (state.activeListId !== listId) return;
  console.error('List subscription error:', err);
  showToast(messageFor(err));
}

function subscribeToActiveList() {
  stopActiveList();
  // With no active list the first-run screen replaces the list, so nothing can be added "into the void"
  appRoot.classList.remove('load-failed');
  appRoot.classList.toggle('no-list', !state.activeListId);
  state.items = [];
  state.purchaseHistory = [];
  render();
  renderStats();
  updateHeaderForList();
  if (!state.activeListId) {
    $('stats').textContent = '';
    return;
  }
  const listId = state.activeListId;
  subscribedListId = listId;

  activeUnsubs.push(FB().onSnapshot(listRef(listId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    updateHeaderForList(data.name);
    if ((data.schemaVersion ?? 1) !== SCHEMA_VERSION) migrateList(listId, data);
  }, (err) => onListError(listId, err)));

  activeUnsubs.push(FB().onSnapshot(FB().collection(FB().db, 'lists', listId, 'items'), (snap) => {
    state.items = sortItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    cleanupStaleBoughtItems();
    render();
    renderStats();
  }, (err) => onListError(listId, err)));

  const recent = FB().query(
    FB().collection(FB().db, 'lists', listId, 'history'),
    FB().where(FB().documentId(), '>=', historyStartKey(Date.now())),
  );
  activeUnsubs.push(FB().onSnapshot(recent, (snap) => {
    state.purchaseHistory = flattenHistory(snap.docs.map((d) => d.data()));
    renderStats();
  }, (err) => onListError(listId, err)));
}

export function switchToList(listId) {
  state.activeListId = listId;
  if (listId) localStorage.setItem('activeListId', listId);
  else localStorage.removeItem('activeListId');
  if (subscribedListId !== listId || !listId) subscribeToActiveList();
}

// ============================================================
// MY LISTS: one live query
// ============================================================
let unsubscribeLists = null;

export function stopSync() {
  if (unsubscribeLists) { unsubscribeLists(); unsubscribeLists = null; }
  stopActiveList();
}

// A list that so far exists only in the local cache (just created, write not yet
// confirmed) must not be opened while online: the server would refuse to show it to a
// "non-member", and the Firestore client does not recover well from that. The confirmed
// version arrives a moment later. Offline everything is read from the cache anyway.
const ready = (list) => !list.pending || !navigator.onLine;

function onListsChanged() {
  if (state.pendingListId && state.lists.some((l) => l.id === state.pendingListId && !l.pending)) state.pendingListId = null;
  const active = state.lists.find((l) => l.id === state.activeListId);
  if (state.activeListId && state.activeListId === state.pendingListId) {
    // createList / joinList opened it already
  } else if (!active) {
    // No active list, or it isn't ours anymore (deleted / left): fall back to the first one
    const next = state.lists.find(ready);
    if (next || state.lists.length === 0) switchToList(next ? next.id : null);
  } else if (subscribedListId !== state.activeListId) {
    if (ready(active)) subscribeToActiveList();
  } else {
    updateHeaderForList();
  }
  document.dispatchEvent(new Event('lists-changed'));
  registerOldJoinCodes();
}

// Called once a user is signed in (and again by the "try again" button).
export function startSync() {
  stopSync();
  appRoot.classList.remove('load-failed');
  let heardFromServer = false;
  const q = FB().query(FB().collection(FB().db, 'lists'), FB().where('members', 'array-contains', state.user.uid));
  unsubscribeLists = FB().onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    if (!snap.metadata.fromCache) heardFromServer = true;
    const lists = snap.docs.map((d) => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }));
    // An empty answer from the device cache may only mean "not loaded yet"; wait for the
    // server before showing the first-run screen.
    if (lists.length === 0 && !heardFromServer) return;
    state.lists = lists;
    onListsChanged();
  }, (err) => {
    // Could not read the lists: say so, instead of pretending the user has none.
    console.error('Loading lists failed:', err);
    $('loadErrorText').textContent = messageFor(err);
    appRoot.classList.remove('no-list');
    appRoot.classList.add('load-failed');
  });
}

// ============================================================
// CREATE / JOIN
// ============================================================

// Creates a list together with its join code (joinCodes/{code} -> listId) in one
// batch. If the random code is already taken the batch is refused, so try another.
// Offline the batch is queued and the list is usable at once.
async function createListWithCode(name) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateJoinCode();
    const ref = FB().doc(FB().collection(FB().db, 'lists'));
    const data = { name, code, ownerUid: state.user.uid, members: [state.user.uid], schemaVersion: SCHEMA_VERSION };
    const batch = FB().writeBatch(FB().db);
    batch.set(ref, { ...data, createdAt: FB().serverTimestamp() });
    batch.set(FB().doc(FB().db, 'joinCodes', code), { listId: ref.id, createdBy: state.user.uid, createdAt: FB().serverTimestamp() });
    const commit = batch.commit();
    if (!navigator.onLine) {
      write(commit);
      return { id: ref.id, ...data };
    }
    try {
      await commit;
      return { id: ref.id, ...data };
    } catch (err) {
      lastErr = err;
      if (err.code !== 'permission-denied') break;
    }
  }
  throw lastErr;
}

// Creates a list and switches to it. Returns true on success; on failure the
// friendly message is shown in errEl.
export async function createList(rawName, errEl, btn) {
  errEl.textContent = '';
  const name = rawName.trim();
  if (!name || !state.user) return false;
  btn.disabled = true;
  try {
    const list = await createListWithCode(name);
    if (!state.lists.some((l) => l.id === list.id)) state.lists.push(list);
    state.pendingListId = list.id;
    switchToList(list.id);
    return true;
  } catch (err) {
    console.error('Create list failed:', err);
    errEl.textContent = messageFor(err);
    return false;
  } finally {
    btn.disabled = false;
  }
}

// Joins the list with this code and switches to it. Returns true on success.
// The code is looked up in joinCodes (one document, never a search over lists); then a
// single batch records "I joined with this code" and adds only me to the members.
export async function joinList(rawCode, errEl, btn) {
  errEl.textContent = '';
  const code = normalizeJoinCode(rawCode);
  if (!code || !state.user) return false;
  if (!isValidJoinCode(code)) { errEl.textContent = t().errNotFound; return false; }
  btn.disabled = true;
  try {
    const codeSnap = await FB().getDoc(FB().doc(FB().db, 'joinCodes', code));
    if (!codeSnap.exists()) {
      errEl.textContent = t().errNotFound;
      return false;
    }
    const { listId } = codeSnap.data();
    const uid = state.user.uid;
    if (!state.lists.some((l) => l.id === listId)) {
      const batch = FB().writeBatch(FB().db);
      batch.set(FB().doc(FB().db, 'lists', listId, 'joins', uid), { code, at: FB().serverTimestamp() });
      batch.update(listRef(listId), { members: FB().arrayUnion(uid) });
      await batch.commit();
    }
    state.pendingListId = listId;
    switchToList(listId);
    return true;
  } catch (err) {
    console.error('Join failed:', err.code, err);
    errEl.textContent = messageFor(err);
    return false;
  } finally {
    btn.disabled = false;
  }
}

// Lists created before join codes had their own collection only store `code` on the
// list itself. The owner's app registers it in joinCodes so that people can join with
// it again (strangers can no longer search lists by code). If that code is already
// used by another list, this list gets a new one. Checked once per list per device.
const codeChecks = new Set();
async function registerOldJoinCodes() {
  for (const list of state.lists) {
    if (list.ownerUid !== state.user.uid) continue;
    const marker = `joinCodeOk:${list.id}:${list.code}`;
    if (localStorage.getItem(marker) || codeChecks.has(marker)) continue;
    codeChecks.add(marker);
    try {
      const valid = isValidJoinCode(list.code);
      const snap = valid ? await FB().getDoc(FB().doc(FB().db, 'joinCodes', list.code)) : null;
      if (snap && snap.exists() && snap.data().listId === list.id) {
        localStorage.setItem(marker, '1');
        continue;
      }
      const code = valid && !snap.exists() ? list.code : generateJoinCode(); // invalid or taken: new code
      const batch = FB().writeBatch(FB().db);
      if (code !== list.code) batch.update(listRef(list.id), { code });
      batch.set(FB().doc(FB().db, 'joinCodes', code), { listId: list.id, createdBy: state.user.uid, createdAt: FB().serverTimestamp() });
      await batch.commit();
      localStorage.setItem(`joinCodeOk:${list.id}:${code}`, '1');
    } catch (err) {
      codeChecks.delete(marker);
      console.error('Registering the join code failed (will retry next time):', list.id, err);
    }
  }
}
