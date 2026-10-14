// Plays the opening cutscene, skips it, checks the player can walk, and saves screenshots.
// The full route to the notebook is covered by walk.mjs.
import { launch, start, skipToWalking, report, SHOTS } from './helpers.mjs';

const { browser, page, errors } = await launch({ size: process.env.SIZE ?? '844x390' });
try {
  await start(page);
  await page.waitForFunction(() => window.__dn.cutscenes?.active?.index === 1, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}smoke-cutscene.png` });
  await skipToWalking(page);
  await page.screenshot({ path: `${SHOTS}smoke-walk-start.png` });
  const state = await page.evaluate(() => ({
    notebook: window.__dn.stage.objects.notebook.visible,
    y: window.__dn.walker.body.position.y,
  }));
  if (!state.notebook) errors.push('notebook is not on the ground after the cutscene');
  if (Math.abs(state.y - 3.6) > 0.05) errors.push(`Light should start on floor 2 (y 3.6), got ${state.y}`);
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
}
report('smoke', errors);
