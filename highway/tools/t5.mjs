const waitFor = (page, fn, ms = 20000) => page.waitForFunction(fn, null, { timeout: ms, polling: 100 });
export default async (page, out) => {
  await page.screenshot({ path: out + '-menu.png' });
  await page.evaluate(() => { __game.ui.screensEl.querySelectorAll('button')[1].click(); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '-garage1.png' });
  // go to formula car
  for (let i = 0; i < 6; i++) await page.evaluate(() => document.querySelector('.g-nav.right').click());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '-garage-f1.png' });
  // give coins & buy
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('neonlanes.save.v1')); });
  await page.evaluate(async () => { const m = await import('/src/storage.js'); m.save.data.coins = 500000; m.save.save(); });
  await page.evaluate(() => document.querySelector('.g-nav.left').click()); await page.evaluate(() => document.querySelector('.g-nav.right').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => [...document.querySelectorAll('.g-panel .btn')].pop().click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('.up .btn').click());
  await page.evaluate(() => document.querySelector('.up .btn').click());
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out + '-garage-bought.png' });
  console.log(await page.evaluate(() => localStorage.getItem('neonlanes.save.v1')));
  await page.evaluate(() => document.querySelector('.g-top .btn').click());
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.evaluate(() => { __game.player.time = 60; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '-f1-run.png' });
  console.log(await page.evaluate(() => JSON.stringify({ car: __game.player.car.id, st: __game.player.stats })));
  // crash for gameover with coins
  await page.evaluate(() => { const g = __game, t = g.traffic; t._spawn(g.player.lane, 12); t.active[t.active.length - 1].z = -3; });
  await waitFor(page, () => __game.state === 'gameover');
  await page.screenshot({ path: out + '-over.png' });
  await page.evaluate(() => [...document.querySelectorAll('.card .btn-row .btn')][1].click());
  await page.waitForTimeout(300);
  await page.evaluate(() => [...document.querySelectorAll('.card .btn-row .btn')][1].click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '-missions.png' });
};
