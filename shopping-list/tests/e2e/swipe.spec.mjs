import { test, expect, resetEmulators, createFirstList, addItem, putItems, serverItems, serverHistory } from './fixtures.mjs';

test.beforeEach(async () => { await resetEmulators(); });

async function swipe(page, rowLocator, dx) {
  const box = await rowLocator.boundingBox();
  const y = box.y + box.height / 2;
  // start on the name (not on a button that swipes ignore)
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y + 1);
  await page.mouse.up();
}

test('Hebrew (right-to-left): swipe left ticks, swipe right deletes', async ({ page }) => {
  const id = await createFirstList(page, 'החלקה');
  await addItem(page, 'חלב');
  await addItem(page, 'לחם');

  await swipe(page, page.locator('.item', { hasText: 'חלב' }), -160);
  await expect(page.locator('.item.bought .item-name')).toHaveText(['חלב']);
  await expect(page.locator('#toastText')).toHaveText('סומן כנקנה: חלב');
  await expect.poll(async () => (await serverHistory(id)).length).toBe(1);

  await swipe(page, page.locator('.item', { hasText: 'לחם' }), 160);
  await expect(page.locator('.item-name')).toHaveText(['חלב']);
  await expect(page.locator('#toastText')).toHaveText('הפריט נמחק');
  await page.click('#toastAction');
  await expect(page.locator('.item-name')).toHaveCount(2);
});

test('English (left-to-right) mirrors it: swipe right ticks, swipe left deletes', async ({ page }) => {
  await createFirstList(page, 'swipe');
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'en');
  await page.click('#closeSettingsBtn');
  await addItem(page, 'milk');
  await addItem(page, 'bread');

  await swipe(page, page.locator('.item', { hasText: 'milk' }), 160);
  await expect(page.locator('.item.bought .item-name')).toHaveText(['milk']);
  await swipe(page, page.locator('.item', { hasText: 'bread' }), -160);
  await expect(page.locator('.item-name')).toHaveText(['milk']);
});

test('a short swipe snaps back and does nothing; a tap afterwards still opens the editor', async ({ page }) => {
  await createFirstList(page, 'קצר');
  await addItem(page, 'ביצים');
  await swipe(page, page.locator('.item'), -40);
  await expect(page.locator('.item.bought')).toHaveCount(0);
  await expect(page.locator('.item')).toHaveCount(1);
  await expect(page.locator('#itemEditOverlay')).not.toHaveClass(/show/);
  await expect(page.locator('.item-swipe')).not.toHaveAttribute('data-swipe', /.+/);

  await page.locator('.item .item-main').click();
  await expect(page.locator('#itemEditOverlay')).toHaveClass(/show/);
});

test('a long swipe does not open the editor either', async ({ page }) => {
  await createFirstList(page, 'ארוך');
  await addItem(page, 'ביצים');
  await swipe(page, page.locator('.item'), -160);
  await expect(page.locator('#itemEditOverlay')).not.toHaveClass(/show/);
});

test('inside each category the most urgent items come first', async ({ page }) => {
  const id = await createFirstList(page, 'דחיפות');
  await putItems(id, [
    { id: 'a', name: 'חלב-בלי', catKey: 'dairy' },
    { id: 'b', name: 'חלב-חייב', catKey: 'dairy', urgency: 'high' },
    { id: 'c', name: 'חלב-כמעט', catKey: 'dairy', urgency: 'medium' },
    { id: 'd', name: 'לחם-חייב', catKey: 'bakery', urgency: 'high' },
    { id: 'e', name: 'חלב-צריך', catKey: 'dairy', urgency: 'low' },
  ]);
  await expect(page.locator('.item-name')).toHaveText(['חלב-חייב', 'חלב-כמעט', 'חלב-צריך', 'חלב-בלי', 'לחם-חייב']);
  expect((await serverItems(id)).length).toBe(5);
});
