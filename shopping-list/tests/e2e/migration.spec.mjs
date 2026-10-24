// Lists created by the previous version have only `code` on the list document. After the
// owner opens the new version once, that same code works for joining again.
import { devices } from '@playwright/test';
import { test, expect, resetEmulators, signInAs, routeFirebase, readListDoc } from './fixtures.mjs';

test.beforeEach(async () => { await resetEmulators(); });

async function createOldStyleList(page, id, code) {
  await page.evaluate(async ({ id, code }) => {
    const { doc, setDoc, serverTimestamp } = window.__fb.firestore;
    const uid = window.FB.auth.currentUser.uid;
    await setDoc(doc(window.FB.db, 'lists', id), {
      name: 'רשימה ישנה', code, ownerUid: uid, members: [uid],
      items: [{ id: '1700000000000', name: 'חלב', bought: false, catKey: 'dairy', catName: 'חלבי 🧀', catColor: 'var(--teal)' }],
      purchaseHistory: [], createdAt: serverTimestamp(),
    });
  }, { id, code });
}

async function secondUser(browser) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:5173' });
  await routeFirebase(ctx);
  const page = await ctx.newPage();
  await page.goto('/');
  await signInAs(page, 'u-guest', 'guest@example.com');
  return { ctx, page };
}

test('an old list keeps its 6-character code: after the owner opens the app, others can join with it', async ({ page, browser }) => {
  await page.goto('/');
  await signInAs(page, 'u-owner', 'owner@example.com');
  await createOldStyleList(page, 'oldList', 'AB3K7M');
  await page.reload();
  await expect(page.locator('#headerTitle')).toContainText('רשימה ישנה');
  await expect(page.locator('.item-name')).toHaveText(['חלב']);

  const { ctx, page: guest } = await secondUser(browser);
  await guest.fill('#welcomeJoinInput', 'ab3k7m');
  await guest.click('#welcomeJoinBtn');
  await expect(guest.locator('#headerTitle')).toContainText('רשימה ישנה');
  await expect(guest.locator('.item-name')).toHaveText(['חלב']);
  await ctx.close();
});

test('if an old code is already used by another list, the old list gets a new code', async ({ page, browser }) => {
  // Someone else's new list already owns "AB3K7M" in joinCodes.
  const { ctx, page: other } = await secondUser(browser);
  await other.evaluate(async () => {
    const { doc, writeBatch, serverTimestamp } = window.__fb.firestore;
    const uid = window.FB.auth.currentUser.uid;
    const batch = writeBatch(window.FB.db);
    batch.set(doc(window.FB.db, 'lists', 'theirs'), { name: 'שלהם', code: 'AB3K7M', ownerUid: uid, members: [uid], items: [], purchaseHistory: [], createdAt: serverTimestamp() });
    batch.set(doc(window.FB.db, 'joinCodes', 'AB3K7M'), { listId: 'theirs', createdBy: uid, createdAt: serverTimestamp() });
    await batch.commit();
  });
  await ctx.close();

  await page.goto('/');
  await signInAs(page, 'u-owner', 'owner@example.com');
  await createOldStyleList(page, 'mine', 'AB3K7M');
  await page.reload();
  await expect(page.locator('#headerTitle')).toContainText('רשימה ישנה');
  await expect.poll(async () => (await readListDoc(page, 'mine')).code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
});
