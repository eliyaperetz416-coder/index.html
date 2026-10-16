// Settings and pause: the three control styles drive the car, pause freezes the race, quality
// and sound settings apply and persist, and reset erases progress.
import { serve, launch, openGame, waitFor, report, SHOTS } from './helpers.mjs';

const { server, url } = await serve();
const { browser, page, errors } = await launch();
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png` });
const center = async (sel) => {
  const b = await page.locator(sel).boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};

try {
  await openGame(page, url);
  await page.evaluate(() => (window.__game.save.coins = 777));
  await page.click('[data-action="settings"]');
  await page.waitForSelector('.screen.settings');
  await shot('50-settings');

  // Buttons style: hold the right pad, the car goes right.
  await page.click('[data-action="setControl"][data-id="buttons"]');
  await page.click('[data-action="menu"]');
  await page.evaluate(() => { window.__game.selectTrack('test'); window.__game.start('test'); window.__game.timeScale = 2; });
  await page.waitForSelector('#controls:not([hidden]) .pad.right');
  const [rx, ry] = await center('.pad.right');
  await page.mouse.move(rx, ry);
  await page.mouse.down();
  await waitFor(page, () => window.__game.race.state === 'racing' && window.__game.race.car.v > 8);
  await page.waitForTimeout(500);
  await shot('51-buttons');
  const x = await page.evaluate(() => window.__game.race.car.x);
  if (!(x > 0.5)) errors.push(`right pad should steer right, x=${x}`);
  await page.mouse.up();

  // Pause freezes the race.
  await page.click('.pause-btn');
  await page.waitForSelector('.screen.pause');
  const t0 = await page.evaluate(() => window.__game.race.time);
  await page.waitForTimeout(600);
  const t1 = await page.evaluate(() => window.__game.race.time);
  if (t1 !== t0) errors.push('race clock should stop while paused');
  await shot('52-pause');
  await page.click('[data-action="resume"]');
  await page.waitForFunction((t) => window.__game.race.time > t, t1, { timeout: 10000 }).catch(() => errors.push('race should run again after resume'));

  // Wheel style from the pause menu's settings.
  await page.click('.pause-btn');
  await page.click('[data-action="pauseSettings"]');
  await page.click('[data-action="setControl"][data-id="wheel"]');
  await page.click('[data-action="pauseBack"]');
  await page.click('[data-action="resume"]');
  await page.waitForSelector('#controls:not([hidden]) .wheel');
  const [wx, wy] = await center('.wheel');
  await page.mouse.move(wx, wy - 70);
  await page.mouse.down();
  await page.mouse.move(wx - 70, wy, { steps: 6 }); // turn left a quarter
  await page.waitForTimeout(500);
  await shot('53-wheel');
  const steer = await page.evaluate(() => window.__game.input.state.steer);
  if (!(steer < -0.5)) errors.push(`turning the wheel left should steer left, steer=${steer}`);
  await page.mouse.up();
  await page.click('.pause-btn');
  await page.click('[data-action="quit"]');

  // Quality and sound persist.
  await page.click('[data-action="settings"]');
  await page.click('[data-action="setQuality"][data-id="low"]');
  await page.click('[data-action="toggleSound"]');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('stunt-racer-save')).settings);
  await page.waitForTimeout(400);
  const st2 = await page.evaluate(() => JSON.parse(localStorage.getItem('stunt-racer-save')).settings);
  if (st2.quality !== 'low' || st2.sound !== false || st2.control !== 'wheel') errors.push(`settings not saved: ${JSON.stringify(st2 ?? st)}`);
  const active = await page.evaluate(() => window.__game.renderer.quality.name);
  if (active !== 'low') errors.push(`quality should switch to low, is ${active}`);

  // Reset progress.
  await page.click('[data-action="askReset"]');
  await page.waitForSelector('.modal');
  await Promise.all([page.waitForEvent('load'), page.click('[data-action="confirmReset"]')]);
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'));
  const coins = await page.evaluate(() => window.__game.save.coins);
  if (coins !== 0) errors.push(`reset should zero the coins, got ${coins}`);
} catch (e) {
  errors.push(String(e));
  await shot('zz-settings-error').catch(() => {});
} finally {
  await browser.close();
  await server.close();
}
report('settings', errors);
