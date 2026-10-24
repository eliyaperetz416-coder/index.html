import { test, expect, resetEmulators, createFirstList, putHistory } from './fixtures.mjs';

const DAY = 86400000;
test.beforeEach(async () => { await resetEmulators(); });

async function withHistory(page) {
  const id = await createFirstList(page, 'סטטיסטיקה');
  const now = Date.now();
  const p = (name, catKey, ago) => ({ name, catKey, timestamp: now - ago * DAY });
  await putHistory(id, [
    p('חלב', 'dairy', 1), p('חלב', 'dairy', 4), p('גבינה', 'dairy', 2), p('לחם', 'bakery', 3),
    p('חלב', 'dairy', 9), p('לחם', 'bakery', 10),
    p('עגבניות', 'veg', 20), p('עגבניות', 'veg', 25), p('חלב', 'dairy', 28),
    p('קפה', 'drinks', 45), p('חלב', 'dairy', 50),
  ]);
  await page.click('#navStatsBtn');
  await expect(page.locator('#statsWeekTotalValue')).toHaveText('4');
  return id;
}

test('week is the default; the month view recounts, compares with the month before and relabels', async ({ page }) => {
  await withHistory(page);
  await expect(page.locator('#periodWeekBtn')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#statsWeekTotalLabel')).toHaveText('פריטים השבוע');
  await expect(page.locator('#statsCompareBox')).toContainText('2 יותר מהשבוע שעבר');

  await page.click('#periodMonthBtn');
  await expect(page.locator('#periodMonthBtn')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#periodWeekBtn')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#statsWeekTotalLabel')).toHaveText('פריטים החודש');
  await expect(page.locator('#statsWeekTotalValue')).toHaveText('9');
  await expect(page.locator('#statsChartTitle')).toHaveText('לפי קטגוריה החודש');
  await expect(page.locator('#statsCompareBox')).toContainText('7 יותר מהחודש שעבר');
  await expect(page.locator('#statsTopCategoryValue')).toHaveText('חלבי 🧀');
});

test('the most bought items are listed with their counts, per period', async ({ page }) => {
  await withHistory(page);
  await expect(page.locator('#statsTopItemsTitle')).toHaveText('הפריטים הנפוצים');
  await expect(page.locator('.top-item-name')).toHaveText(['חלב', 'גבינה', 'לחם']);
  await expect(page.locator('.top-item-count')).toHaveText(['×2', '×1', '×1']);
  await page.click('#periodMonthBtn');
  await expect(page.locator('.top-item-name')).toHaveText(['חלב', 'לחם', 'עגבניות', 'גבינה']);
  await expect(page.locator('.top-item-count')).toHaveText(['×4', '×2', '×2', '×1']);
});

test('the chosen period is remembered', async ({ page }) => {
  await withHistory(page);
  await page.click('#periodMonthBtn');
  await page.reload();
  await page.click('#navStatsBtn');
  await expect(page.locator('#periodMonthBtn')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#statsWeekTotalValue')).toHaveText('9');
});

test('an empty history shows friendly empty states in both periods', async ({ page }) => {
  await createFirstList(page, 'ריק');
  await page.click('#navStatsBtn');
  await expect(page.locator('#statsCompareBox')).toContainText('עדיין אין מספיק נתונים');
  await expect(page.locator('#statsTopCategoryValue')).toHaveText('–');
  await expect(page.locator('#statsTopItems .stats-empty')).toBeVisible();
  await page.click('#periodMonthBtn');
  await expect(page.locator('#statsWeekTotalValue')).toHaveText('0');
  await expect(page.locator('#statsChart .stats-empty')).toBeVisible();
});

test('the stats screen is translated, including the new texts', async ({ page }) => {
  await withHistory(page);
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'en');
  await page.click('#closeSettingsBtn');
  await expect(page.locator('#periodWeekBtn')).toHaveText('Week');
  await expect(page.locator('#statsTopItemsTitle')).toHaveText('Most bought');
  await page.click('#periodMonthBtn');
  await expect(page.locator('#statsCompareBox')).toContainText('7 more than last month');
});
