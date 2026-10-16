// usage: node tools/world.mjs <worldId> [WxH] -> /tmp/s/world-<id>.png
export default async (page, out) => {
  const id = process.env.WORLD;
  await page.evaluate((id) => { __game.loadWorld(id); }, id);
  await page.keyboard.press('Enter');
  await page.evaluate(() => { __game.player.time = 60; });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: out + '-' + id + '.png' });
};
