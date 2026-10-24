import { test, expect, resetEmulators, createFirstList, addItem, putHistory, serverItems } from './fixtures.mjs';

const DAY = 86400000;
test.beforeEach(async () => { await resetEmulators(); });

async function listWithHistory(page) {
  const id = await createFirstList(page, 'השלמה');
  const now = Date.now();
  await putHistory(id, [
    { name: 'חלב', catKey: 'dairy', timestamp: now - 3 * DAY }, { name: 'חלב', catKey: 'dairy', timestamp: now - 10 * DAY },
    { name: 'חלה', catKey: 'bakery', timestamp: now - 5 * DAY },
    { name: 'זעתר', catKey: 'baking', timestamp: now - 7 * DAY },
  ]);
  await page.click('#navStatsBtn'); await page.click('#navListBtn'); // lets the history listener deliver
  return id;
}

test('typing shows past purchases, most frequent first; tapping one adds it with its category', async ({ page }) => {
  const id = await listWithHistory(page);
  await page.fill('#itemInput', 'חל');
  await expect(page.locator('.suggest-option')).toHaveText(['חלב', 'חלה']);
  await expect(page.locator('#itemInput')).toHaveAttribute('aria-expanded', 'true');

  await page.locator('.suggest-option', { hasText: 'חלה' }).click();
  await expect(page.locator('.item-name')).toHaveText(['חלה']);
  await expect(page.locator('.item', { hasText: 'חלה' }).locator('.item-cat')).toHaveText('מאפים 🍞');
  await expect(page.locator('#suggestBox')).toBeHidden();
  await expect(page.locator('#itemInput')).toHaveValue('');
  await expect.poll(async () => (await serverItems(id)).map((i) => `${i.name}:${i.catKey}`)).toEqual(['חלה:bakery']);
});

test('arrow keys and Enter pick a suggestion; Escape closes; Enter without selection adds the typed text', async ({ page }) => {
  await listWithHistory(page);
  await page.fill('#itemInput', 'חל');
  await page.press('#itemInput', 'ArrowDown');
  await page.press('#itemInput', 'ArrowDown');
  await expect(page.locator('.suggest-option[aria-selected="true"]')).toHaveText('חלה');
  await page.press('#itemInput', 'Enter');
  await expect(page.locator('.item-name')).toHaveText(['חלה']);

  await page.fill('#itemInput', 'זע');
  await expect(page.locator('#suggestBox')).toBeVisible();
  await page.press('#itemInput', 'Escape');
  await expect(page.locator('#suggestBox')).toBeHidden();

  await page.fill('#itemInput', 'חלי');
  await page.press('#itemInput', 'Enter');
  await expect(page.locator('.item-name', { hasText: 'חלי' })).toBeVisible();
});

test('items already waiting on the list are not suggested again, and nothing shows for unknown text', async ({ page }) => {
  await listWithHistory(page);
  await addItem(page, 'חלב');
  await page.fill('#itemInput', 'חל');
  await expect(page.locator('.suggest-option')).toHaveText(['חלה']);
  await page.fill('#itemInput', 'xyz');
  await expect(page.locator('#suggestBox')).toBeHidden();
});
