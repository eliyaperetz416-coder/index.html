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
