export default async (page, out) => {
  await page.screenshot({ path: out + '-title.png' });
  await page.keyboard.press('Enter');
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(3500);
    await page.screenshot({ path: out + '-p' + i + '.png' });
    const s = await page.evaluate(() => ({ st: __game.state, score: Math.round(__game.run.score), kmh: Math.round(__game.player.kmh), n: __game.traffic.active.length }));
    console.log(JSON.stringify(s));
    if (s.st === 'gameover') break;
  }
};
