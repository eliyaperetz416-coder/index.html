export default async (page, out) => {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  // lane change keys
  const lane0 = await page.evaluate(() => __game.player.lane);
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(500);
  const lane1 = await page.evaluate(() => __game.player.lane);
  console.log('lane', lane0, '->', lane1);
  // force a crash: drop a car right on the player
  await page.evaluate(() => { const t = __game.traffic; t._spawn(__game.player.lane, 20); t.active[t.active.length - 1].z = -4; });
  await page.waitForTimeout(700);
  console.log('state', await page.evaluate(() => __game.state));
  await page.screenshot({ path: out + '-over.png' });
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  console.log('after restart', await page.evaluate(() => __game.state + ' score ' + Math.round(__game.run.score)));
  console.log('saved best', await page.evaluate(() => localStorage.getItem('neonlanes.save.v1')));
};
