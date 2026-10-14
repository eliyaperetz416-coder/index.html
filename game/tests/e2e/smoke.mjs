// Plays the opening, walks to the notebook, checks for console errors and saves screenshots.
import { launch, start, skipToWalking, driveTo, report, SHOTS } from './helpers.mjs';

const ROUTE = [[1.8, -2.72], [-2.9, -2.72], [-2.9, -4.4], [4.6, -4.4], [9, 1]];

const { browser, page, errors } = await launch({ size: process.env.SIZE ?? '844x390' });
try {
  await start(page);
  await page.waitForFunction(() => window.__dn.cutscenes?.active?.index === 1, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}smoke-cutscene.png` });
  await skipToWalking(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}smoke-walk-start.png` });
  for (const [i, point] of ROUTE.entries()) {
    // The walk step ends within 1 m of the notebook, so the last point only needs that radius.
    await driveTo(page, point, { tolerance: i === ROUTE.length - 1 ? 1.02 : 0.25 });
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}smoke-notebook.png` });
  const objective = await page.evaluate(() => document.querySelector('#objective .text').textContent);
  if (objective !== 'הרם את המחברת') errors.push(`walk step did not end at the notebook (objective: ${objective})`);
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
}
report('smoke', errors);
