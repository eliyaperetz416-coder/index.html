export default async (page, out) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '-menu.png' });
  await page.keyboard.press('Enter'); await page.evaluate(() => { __game.player.time = 90; });
  await page.waitForTimeout(5000);
  await page.keyboard.down('Space'); await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '-play.png' });
  await page.keyboard.up('Space');
  await page.keyboard.press('p'); await page.waitForTimeout(2500);
  await page.screenshot({ path: out + '-pause.png' });
};
