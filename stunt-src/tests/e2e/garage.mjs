// Garage: buy a car, upgrade it, buy and equip paint and underglow; it all survives a reload.
// Daily missions screen shows three missions. Idle earnings pop-up pays out.
import { serve, launch, openGame, report, SHOTS } from './helpers.mjs';

const { server, url } = await serve();
const { browser, page, errors } = await launch();
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png` });
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('stunt-racer-save')));

try {
  await openGame(page, url);
  await page.evaluate(() => {
    window.__game.save.coins = 20000;
    window.__game.menu();
  });
  await page.click('[data-action="garage"]');
  await page.waitForSelector('.screen.garage');
  await page.waitForTimeout(400);
  await shot('20-garage');
  // Go to the Kestrel (sport) and buy it.
  for (let i = 0; i < 2; i++) await page.click('[data-action="nextCar"]');
  const name = await page.textContent('.car-name b');
  if (name !== 'Kestrel') errors.push(`expected Kestrel, got ${name}`);
  await page.click('[data-action="buyCar"]');
  await page.waitForTimeout(400);
  await page.click('[data-action="tab"][data-id="upgrade"]');
  await page.click('[data-action="upgrade"][data-id="speed"]');
  await page.click('[data-action="upgrade"][data-id="idle"]');
  await shot('21-upgrades');
  await page.click('[data-action="tab"][data-id="paint"]');
  await page.click('[data-action="preview"][data-id="neon-lime"]');
  await page.click('[data-action="buyCosmetic"]');
  await page.click('[data-action="tab"][data-id="glow"]');
  await page.click('[data-action="preview"][data-id="pink"]');
  await page.click('[data-action="buyCosmetic"]');
  await page.waitForTimeout(600);
  await shot('22-glow');
  await page.waitForTimeout(400);
  let s = await save();
  const k = s.cars.kestrel;
  if (!k?.owned || k.up.speed !== 1 || k.up.idle !== 1 || k.paint !== 'neon-lime' || k.glow !== 'pink') errors.push(`kestrel not saved right: ${JSON.stringify(k)}`);
  if (s.selectedCar !== 'kestrel') errors.push('kestrel should be selected after buying');

  // Reload: still there; the race uses the Kestrel.
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'));
  const car = await page.evaluate(() => window.__game.carDef.id);
  if (car !== 'kestrel') errors.push(`after reload the selected car is ${car}`);

  // Missions.
  await page.click('[data-action="missions"]');
  await page.waitForSelector('.mission');
  const n = await page.$$eval('.mission:not(.bonus)', (els) => els.length);
  if (n !== 3) errors.push(`expected 3 daily missions, got ${n}`);
  await shot('23-missions');

  // Idle earnings: pretend we left 3 hours ago.
  await page.evaluate(() => {
    const g = window.__game;
    g.save.idle.last = Date.now() - 3 * 3.6e6;
    g.menu();
    g.checkIdle();
  });
  await page.waitForSelector('.modal');
  await page.waitForTimeout(600);
  await shot('24-idle');
  const before = await page.evaluate(() => window.__game.save.coins);
  await page.click('[data-action="collectIdle"]');
  const after = await page.evaluate(() => window.__game.save.coins);
  if (!(after > before)) errors.push(`idle collect should add coins (${before} -> ${after})`);
} catch (e) {
  errors.push(String(e));
  await shot('zz-garage-error').catch(() => {});
} finally {
  await browser.close();
  await server.close();
}
report('garage', errors);
