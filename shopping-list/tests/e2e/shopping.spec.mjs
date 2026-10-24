import { test, expect, resetEmulators, createFirstList, putItems, serverItems } from './fixtures.mjs';

test.beforeEach(async () => { await resetEmulators(); });

async function seeded(page) {
  const id = await createFirstList(page, 'סופר');
  await putItems(id, [
    { id: 'm1', name: 'חלב', catKey: 'dairy' },
    { id: 'm2', name: 'גבינה', catKey: 'dairy', urgency: 'high' },
    { id: 'b1', name: 'לחם', catKey: 'bakery' },
    { id: 'v1', name: 'מלפפון', catKey: 'veg' },
  ]);
  await expect(page.locator('.item')).toHaveCount(4);
  return id;
}

test('shopping mode groups items by category with big rows; the choice is remembered', async ({ page }) => {
  await seeded(page);
  await expect(page.locator('#shopModeBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.cat-header')).toHaveCount(0);

  await page.click('#shopModeBtn');
  await expect(page.locator('#shopModeBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#appRoot')).toHaveClass(/shopping/);
  await expect(page.locator('.cat-header-name')).toHaveText(['חלבי 🧀', 'מאפים 🍞', 'ירקות 🥬']);
  await expect(page.locator('.cat-header-count')).toHaveText(['0/2', '0/1', '0/1']);
  await expect(page.locator('.cat-group').first().locator('.item-name')).toHaveText(['גבינה', 'חלב']);
  const row = await page.locator('.item').first().boundingBox();
  expect(row.height).toBeGreaterThanOrEqual(64);
  const box = await page.locator('.item .checkbox').first().boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(32);

  await page.reload();
  await expect(page.locator('#appRoot')).toHaveClass(/shopping/);
  await page.click('#shopModeBtn');
  await expect(page.locator('#appRoot')).not.toHaveClass(/shopping/);
  await expect(page.locator('.cat-header')).toHaveCount(0);
});

test('a category can be folded and unfolded; a finished category folds itself once', async ({ page }) => {
  await seeded(page);
  await page.click('#shopModeBtn');

  const dairy = page.locator('.cat-header[data-cat="dairy"]');
  await dairy.click();
  await expect(dairy).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.item-name', { hasText: 'חלב' })).toHaveCount(0);
  await dairy.click();
  await expect(page.locator('.item-name', { hasText: 'חלב' })).toBeVisible();

  // Tick the only bakery item: its category is finished and folds itself.
  await page.locator('.item', { hasText: 'לחם' }).locator('.checkbox').click();
  await expect(page.locator('.cat-header[data-cat="bakery"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.cat-header[data-cat="bakery"] .cat-header-count')).toHaveText('1/1');
  // ...but the user can still open it again, and it stays open.
  await page.locator('.cat-header[data-cat="bakery"]').click();
  await expect(page.locator('.item-name', { hasText: 'לחם' })).toBeVisible();
  await page.locator('.item', { hasText: 'מלפפון' }).locator('.checkbox').click();
  await expect(page.locator('.item-name', { hasText: 'לחם' })).toBeVisible();
});

test('"clear what is bought" removes the ticked items and can be undone', async ({ page }) => {
  const id = await seeded(page);
  await expect(page.locator('#clearBoughtBtn')).toBeHidden();
  await page.locator('.item', { hasText: 'לחם' }).locator('.checkbox').click();
  await page.locator('.item').filter({ has: page.locator('.item-name', { hasText: /^חלב$/ }) }).locator('.checkbox').click();
  await expect(page.locator('#clearBoughtBtn')).toBeVisible();
  await expect(page.locator('#clearBoughtBtn')).toHaveText('נקה את מה שנקנה (2)');

  await page.click('#clearBoughtBtn');
  await expect(page.locator('.item-name')).toHaveCount(2);
  await expect(page.locator('#clearBoughtBtn')).toBeHidden();
  await expect(page.locator('#toastText')).toHaveText('2 פריטים נמחקו');
  await expect.poll(async () => (await serverItems(id)).length).toBe(2);

  await page.click('#toastAction');
  await expect(page.locator('.item-name')).toHaveCount(4);
  await expect(page.locator('.item.bought')).toHaveCount(2);
  await expect.poll(async () => (await serverItems(id)).filter((i) => i.bought).length).toBe(2);
});

test('shopping mode keeps the screen awake and lets go when switched off', async ({ page }) => {
  await page.addInitScript(() => {
    window.__wake = { requests: 0, releases: 0 };
    Object.defineProperty(navigator, 'wakeLock', { value: {
      request: async () => { window.__wake.requests++; return { release: async () => { window.__wake.releases++; }, addEventListener() {} }; },
    } });
  });
  await seeded(page);
  await page.click('#shopModeBtn');
  await expect.poll(() => page.evaluate(() => window.__wake.requests)).toBe(1);
  await page.click('#shopModeBtn');
  await expect.poll(() => page.evaluate(() => window.__wake.releases)).toBe(1);
});

test('the shopping mode texts follow the language', async ({ page }) => {
  await seeded(page);
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'en');
  await page.click('#closeSettingsBtn');
  await expect(page.locator('#shopModeLabel')).toHaveText('Shopping mode');
  await page.locator('.item .checkbox').first().click();
  await expect(page.locator('#clearBoughtBtn')).toHaveText('Clear what’s bought (1)');
});
