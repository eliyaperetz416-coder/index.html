export default async (page, out) => {
  await page.keyboard.press('Enter');
  await page.evaluate(() => { __game.player.time = 120; });
  await page.waitForTimeout(6000);
  const info = () => page.evaluate(() => { const i = __game.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, progs: i.programs.length }; });
  console.log('play', JSON.stringify(await info()), 'active cars', await page.evaluate(() => __game.traffic.active.length));
  for (const w of ['rainynight', 'tunnel', 'neoncity', 'rainynight', 'neoncity']) {
    await page.evaluate((w) => __game.loadWorld(w), w); await page.waitForTimeout(500);
    console.log(w, JSON.stringify(await info()));
  }
  for (const q of ['low', 'medium', 'high', 'low', 'high']) {
    await page.evaluate(async (q) => { const m = await import('/src/storage.js'); m.save.data.settings.quality = q; __game.applyQuality(); }, q); await page.waitForTimeout(500);
    console.log('q', q, JSON.stringify(await info()));
  }
};
