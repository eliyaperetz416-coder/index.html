// Menu -> HOLD TO RIDE -> drive the test track with the mouse held down -> finish screen ->
// coins saved -> next track. Saves screenshots along the way in tests/e2e/shots/.
import { serve, launch, openGame, holdOn, waitFor, report, SHOTS } from './helpers.mjs';

const { server, url } = await serve();
const { browser, page, errors } = await launch();
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png` });

try {
  await openGame(page, url);
  await page.waitForTimeout(500);
  await shot('01-menu');

  const { x, y } = await holdOn(page, '[data-press="ride"]');
  await waitFor(page, () => window.__game.mode === 'race');
  await page.evaluate(() => (window.__game.timeScale = 2.5));
  await page.waitForTimeout(400);
  await shot('02-countdown');

  // Steer: slide left, the car should move left (negative x).
  await waitFor(page, () => window.__game.race.state === 'racing' && window.__game.race.car.v > 15);
  await page.mouse.move(x - 120, y, { steps: 4 });
  await page.waitForTimeout(500);
  const left = await page.evaluate(() => window.__game.race.car.x);
  if (!(left < -0.5)) errors.push(`sliding left should move the car left, x=${left}`);
  // Back to the (floating) anchor: straight ahead again.
  const anchor = await page.evaluate(() => window.__game.input.pointer.anchor);
  await page.mouse.move(anchor, y, { steps: 4 });
  await page.waitForTimeout(200);
  await shot('03-driving');

  const at = async (cond, name) => {
    await waitFor(page, cond);
    await shot(name);
  };
  await at(() => window.__game.race.car.mode === 'air', '04-jump');
  await at(() => { const r = window.__game.race; return r.car.trackS > r.path.pieceRange(6)[0] + 20; }, '05-drop');
  await at(() => { const r = window.__game.race; const [a, b] = r.path.pieceRange(8); return r.car.trackS > a + (b - a) * 0.45; }, '06-loop');

  // Release: the car brakes.
  await page.mouse.up();
  const v0 = await page.evaluate(() => window.__game.race.car.v);
  await page.waitForTimeout(500);
  const v1 = await page.evaluate(() => window.__game.race.car.v);
  if (!(v1 < v0)) errors.push(`lifting the finger should brake (${v0} -> ${v1})`);
  await page.mouse.down();

  await waitFor(page, () => window.__game.screens.current === 'finish');
  await page.mouse.up();
  await page.waitForTimeout(2600);
  await shot('07-finish');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('stunt-racer-save')));
  if (!(saved?.coins > 0)) errors.push(`coins were not saved: ${JSON.stringify(saved)}`);
  if (!(saved?.tracks?.test?.best > 0)) errors.push('best time was not saved');

  await page.click('[data-action="next"]');
  await waitFor(page, () => window.__game.mode === 'race' && window.__game.race.state === 'countdown');

  // Keyboard driving works too.
  await page.keyboard.down('ArrowUp');
  await waitFor(page, () => window.__game.race.state === 'racing' && window.__game.race.car.v > 10);
  await page.keyboard.up('ArrowUp');
} catch (e) {
  errors.push(String(e));
  await shot('zz-error').catch(() => {});
} finally {
  await browser.close();
  await server.close();
}
report('smoke', errors);
