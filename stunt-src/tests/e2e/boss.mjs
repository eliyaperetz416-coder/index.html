// Boss race: with Neon Night finished, the rival card shows an intro, the race has a rival car
// with a name tag, winning opens Dune Rush. Also screenshots the desert world.
import { serve, launch, openGame, waitFor, report, SHOTS } from './helpers.mjs';

const { server, url } = await serve();
const { browser, page, errors } = await launch();
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png` });

try {
  await openGame(page, url);
  await page.evaluate(() => {
    const g = window.__game;
    for (const id of ['neon-1', 'neon-2', 'neon-3', 'neon-4', 'neon-5']) g.save.tracks[id] = { best: 60, done: 1, medal: 'gold' };
    g.showTracks();
  });
  const lockedDesert = await page.$$eval('.track-card[data-id^="desert"]', (els) => els.every((e) => e.disabled));
  if (!lockedDesert) errors.push('desert tracks should be locked before the boss is beaten');
  await page.click('.track-card[data-id="neon-boss"]');
  await page.waitForSelector('.boss-card');
  await page.waitForTimeout(600);
  await shot('30-boss-intro');
  await page.click('[data-action="raceBoss"]');
  await waitFor(page, () => window.__game.mode === 'race' && window.__game.race.rivals.length === 1);
  await page.evaluate(() => { window.__game.setAutopilot(true); window.__game.timeScale = 3; });
  await waitFor(page, () => window.__game.race.state === 'racing' && window.__game.race.time > 2.5);
  await shot('31-boss-race');
  const place = await page.textContent('.place');
  if (!/1ST|2ND/.test(place)) errors.push(`place indicator missing: "${place}"`);
  await waitFor(page, () => window.__game.screens.current === 'finish', null, 400000);
  await page.waitForTimeout(2500);
  await shot('32-boss-result');
  const won = await page.evaluate(() => window.__game.race.won);
  const text = await page.textContent('.screen.finish');
  if (won && !/NEW WORLD UNLOCKED/.test(text)) errors.push('winning should announce the new world');
  if (!won) console.log('note: autopilot lost the boss race this run');
  // Desert world look.
  await page.evaluate(() => {
    const g = window.__game;
    g.save.tracks['neon-boss'] = { best: 60, done: 1 };
    g.setAutopilot(false);
    g.timeScale = 1;
    g.selectTrack('desert-1');
  });
  await page.waitForTimeout(800);
  await shot('33-desert-menu');
  await page.evaluate(() => {
    const g = window.__game;
    g.loop.stop();
    g.start('desert-1');
    g.setAutopilot(true);
    for (let i = 0; i < 30 * 12; i++) g.tick(1 / 30);
  });
  await shot('34-desert-race');
} catch (e) {
  errors.push(String(e));
  await shot('zz-boss-error').catch(() => {});
} finally {
  await browser.close();
  await server.close();
}
report('boss', errors);
