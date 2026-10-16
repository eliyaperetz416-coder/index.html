export default async (page, out) => {
  await page.keyboard.press('Enter');
  await page.evaluate(() => { __game.player.time = 60; });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(3000);
    const s = await page.evaluate(() => ({ st: __game.state, n: __game.traffic.active.length, zs: __game.traffic.active.map(c => Math.round(c.z)).join(',') }));
    console.log(JSON.stringify(s));
    await page.screenshot({ path: out + '-p' + i + '.png' });
    if (s.st === 'gameover') break;
  }
};
