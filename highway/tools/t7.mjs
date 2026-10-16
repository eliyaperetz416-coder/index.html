const waitFor = (page, fn, ms = 20000) => page.waitForFunction(fn, null, { timeout: ms, polling: 100 });
export default async (page, out) => {
  await page.screenshot({ path: out + '-menu.png' });
  await page.evaluate(() => [...document.querySelectorAll('.card .btn-row .btn')].find((b) => b.textContent.startsWith('Events')).click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '-events.png' });
  const evs = await page.evaluate(async () => { const m = await import('/src/events.js'); return m.listEvents().map((s) => s.ev.id + ':' + s.state); });
  console.log(evs.join(' '));
  // play first active event & complete it by cheating progress
  await page.evaluate(() => [...document.querySelectorAll('.event .btn')][0].click());
  await page.waitForTimeout(800);
  console.log('world', await page.evaluate(() => __game.worldDef.id), 'ev', await page.evaluate(() => __game.runEvent && __game.runEvent.ev.id));
  await page.evaluate(async () => { const m = await import('/src/storage.js'); const e = __game.runEvent; m.save.data.eventProgress[e.key] = e.ev.goal.target - 1; m.save.save(); });
  await page.evaluate(() => { __game.scoring.closeCalls = 5; __game.scoring.score = 40000; __game.run.distance = 3e5; });
  await page.evaluate(() => { const g = __game, t = g.traffic; t._spawn(g.player.lane, 12); t.active[t.active.length - 1].z = -3; });
  await waitFor(page, () => __game.state === 'gameover');
  await page.screenshot({ path: out + '-over.png' });
  console.log(await page.evaluate(() => JSON.stringify({ owned: JSON.parse(localStorage.getItem('neonlanes.save.v1')).ownedCars, coins: JSON.parse(localStorage.getItem('neonlanes.save.v1')).coins })));
};
