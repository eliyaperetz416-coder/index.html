import { devices } from '@playwright/test';
import { test, expect, resetEmulators, signInAs, readListDoc, activeListId, routeFirebase } from './fixtures.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.beforeEach(async () => { await resetEmulators(); });

test('a brand-new user sees the welcome screen, not an empty list that swallows items', async ({ page }) => {
  await page.goto('/');
  await signInAs(page, 'u-new', 'new@example.com');

  await expect(page.locator('#welcomeScreen')).toBeVisible();
  await expect(page.locator('#welcomeTitle')).toHaveText('ברוכים הבאים 👋');
  await expect(page.locator('#listScreen')).toBeHidden();
  await expect(page.locator('#itemInput')).toBeHidden();
  await expect(page.locator('.bottom-nav')).toBeHidden();
});

test('creating the first list from the welcome screen opens it, and items persist with UUID ids', async ({ page }) => {
  await page.goto('/');
  await signInAs(page, 'u-a', 'a@example.com');

  await page.fill('#welcomeNewListInput', 'קניות לשבת');
  await page.click('#welcomeCreateBtn');

  await expect(page.locator('#welcomeScreen')).toBeHidden();
  await expect(page.locator('#headerTitle')).toContainText('קניות לשבת');
  await expect(page.locator('#itemInput')).toBeVisible();

  await page.fill('#itemInput', 'חלב');
  await page.click('#addBtn');
  await expect(page.locator('.item-name', { hasText: 'חלב' })).toBeVisible();

  const listId = await activeListId(page);
  await expect.poll(async () => (await readListDoc(page, listId)).items.length).toBe(1);
  const doc = await readListDoc(page, listId);
  expect(doc.items[0].id).toMatch(UUID);
  expect(doc.items[0].catKey).toBe('dairy');

  // survives a reload
  await page.reload();
  await expect(page.locator('.item-name', { hasText: 'חלב' })).toBeVisible();
});

test('marking bought adds one purchase and un-marking removes it again', async ({ page }) => {
  await page.goto('/');
  await signInAs(page, 'u-b', 'b@example.com');
  await page.fill('#welcomeNewListInput', 'בדיקה');
  await page.click('#welcomeCreateBtn');
  await page.fill('#itemInput', 'ביצים');
  await page.click('#addBtn');
  const listId = await activeListId(page);

  const history = async () => (await readListDoc(page, listId)).purchaseHistory.length;

  await page.locator('.checkbox').first().click();
  await expect.poll(history).toBe(1);

  await page.locator('.checkbox').first().click();
  await expect.poll(history).toBe(0);

  await page.locator('.checkbox').first().click();
  await expect.poll(history).toBe(1);
});

test('a wrong join code shows "not found"; a real code from a second user joins', async ({ page, browser }) => {
  await page.goto('/');
  await signInAs(page, 'u-owner', 'owner@example.com');
  await page.fill('#welcomeNewListInput', 'משפחה');
  await page.click('#welcomeCreateBtn');
  await page.fill('#itemInput', 'לחם');
  await page.click('#addBtn');
  const listId = await activeListId(page);
  const { code } = await readListDoc(page, listId);

  const ctx2 = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:5173' });
  await routeFirebase(ctx2);
  const page2 = await ctx2.newPage();

  await page2.goto('/');
  await signInAs(page2, 'u-guest', 'guest@example.com');
  await expect(page2.locator('#welcomeScreen')).toBeVisible();

  await page2.fill('#welcomeJoinInput', 'ZZZZZZ');
  await page2.click('#welcomeJoinBtn');
  await expect(page2.locator('#welcomeJoinError')).toHaveText('לא נמצאה רשימה עם הקוד הזה');

  await page2.fill('#welcomeJoinInput', code.toLowerCase());
  await page2.click('#welcomeJoinBtn');
  await expect(page2.locator('#welcomeScreen')).toBeHidden();
  await expect(page2.locator('.item-name', { hasText: 'לחם' })).toBeVisible();
  await ctx2.close();
});
