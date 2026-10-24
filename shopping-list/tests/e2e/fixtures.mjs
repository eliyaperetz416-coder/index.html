import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bundle = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache/fb-all.js'));
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'text/javascript' };
const PROJECT = 'demo-shopping-list';

// Serve the emulator-backed SDK instead of the CDN files.
export async function routeFirebase(context) {
  await context.route('https://www.gstatic.com/firebasejs/**', (route) => {
    route.fulfill({ status: 200, headers: CORS, body: "export * from 'https://www.gstatic.com/__fb/all.js';" });
  });
  await context.route('https://www.gstatic.com/__fb/all.js', (route) => route.fulfill({ status: 200, headers: CORS, body: bundle }));
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await routeFirebase(context);
    await use(context);
  },
});

export { expect };

export async function resetEmulators() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

// Signs the page in as a fake Google user (the Auth emulator accepts an unsigned JSON "id token").
export async function signInAs(page, sub, email) {
  await page.waitForFunction(() => window.FB && window.__fb);
  await page.evaluate(async ({ sub, email }) => {
    const { GoogleAuthProvider, signInWithCredential } = window.__fb.auth;
    const credential = GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }));
    await signInWithCredential(window.FB.auth, credential);
  }, { sub, email });
}

export async function readListDoc(page, listId) {
  return page.evaluate(async (id) => {
    const { doc, getDoc } = window.__fb.firestore;
    const snap = await getDoc(doc(window.FB.db, 'lists', id));
    return snap.exists() ? snap.data() : null;
  }, listId);
}

export const activeListId = (page) => page.evaluate(() => localStorage.getItem('activeListId'));

// Writes fields straight into a list document (as another device / member would).
export async function patchListDoc(page, listId, data) {
  await page.evaluate(async ({ id, data }) => {
    const { doc, updateDoc } = window.__fb.firestore;
    await updateDoc(doc(window.FB.db, 'lists', id), data);
  }, { id: listId, data });
}

export async function createFirstList(page, name, sub = 'u-x') {
  await page.goto('/');
  await signInAs(page, sub, `${sub}@example.com`);
  await page.fill('#welcomeNewListInput', name);
  await page.click('#welcomeCreateBtn');
  await page.waitForSelector('#itemInput', { state: 'visible' });
  return activeListId(page);
}

export async function addItem(page, name) {
  await page.fill('#itemInput', name);
  await page.click('#addBtn');
  await page.locator('.item-name', { hasText: name }).first().waitFor();
}

// ---------- direct emulator access (bypasses the rules, like data left by older versions) ----------
const REST = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const ADMIN = { Authorization: 'Bearer owner', 'content-type': 'application/json' };
const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
}

function fromValue(v) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return v;
}
const fromFields = (fields) => Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, fromValue(x)]));

export async function adminSet(path, data) {
  const res = await fetch(`${REST}/${encodePath(path)}`, {
    method: 'PATCH', headers: ADMIN, body: JSON.stringify({ fields: toValue(data).mapValue.fields }),
  });
  if (!res.ok) throw new Error(`adminSet ${path}: ${res.status} ${await res.text()}`);
}

export async function adminGet(path) {
  const res = await fetch(`${REST}/${encodePath(path)}`, { headers: ADMIN });
  if (res.status === 404) return null;
  return fromFields((await res.json()).fields || {});
}

// All documents of a collection as [{ id, ...fields }].
export async function adminList(path) {
  const res = await fetch(`${REST}/${encodePath(path)}?pageSize=1000`, { headers: ADMIN });
  const body = await res.json();
  return (body.documents || []).map((d) => ({ id: decodeURIComponent(d.name.split('/').pop()), ...fromFields(d.fields || {}) }));
}

export const serverItems = (listId) => adminList(`lists/${listId}/items`);
export async function serverHistory(listId) {
  return (await adminList(`lists/${listId}/history`)).flatMap((b) => b.entries || []);
}

// Writes items as documents of the list (fills in the required fields).
export async function putItems(listId, items) {
  for (const [i, it] of items.entries()) {
    const { id, ...fields } = it;
    await adminSet(`lists/${listId}/items/${id}`, { bought: false, boughtAt: null, createdAt: i, createdBy: 'test', catKey: 'other', ...fields });
  }
}

// Files purchase entries into their monthly (UTC) history buckets.
export async function putHistory(listId, entries) {
  const buckets = {};
  for (const e of entries) (buckets[new Date(e.timestamp).toISOString().slice(0, 7)] ||= []).push(e);
  for (const [month, list] of Object.entries(buckets)) await adminSet(`lists/${listId}/history/${month}`, { entries: list });
}

export const currentUid = (page) => page.evaluate(() => window.FB.auth.currentUser.uid);
