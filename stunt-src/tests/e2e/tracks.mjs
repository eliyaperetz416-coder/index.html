// Track list: only the first track is open; picking it starts a race; finishing it (autopilot)
// unlocks the second.
import { serve, launch, openGame, waitFor, report, SHOTS } from './helpers.mjs';

const { server, url } = await serve();
const { browser, page, errors } = await launch();
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png` });

try {
  await openGame(page, url);
  await page.click('[data-action="tracks"]');
  await page.waitForSelector('.track-card');
  await shot('10-tracks');
  const cards = await page.$$eval('.track-card', (els) => els.map((e) => ({ id: e.dataset.id, locked: e.classList.contains('locked') })));
  if (cards.length < 5) errors.push(`expected the career tracks, got ${cards.length}`);
  if (cards[0].locked || !cards.slice(1).every((c) => c.locked)) errors.push(`only the first track should be open: ${JSON.stringify(cards)}`);

  await page.click(`.track-card[data-id="${cards[0].id}"]`);
  await waitFor(page, (id) => window.__game.mode === 'race' && window.__game.race.track.id === id, cards[0].id);
  await page.evaluate(() => {
    window.__game.setAutopilot(true);
    window.__game.timeScale = 4;
  });
  await waitFor(page, () => window.__game.screens.current === 'finish', null, 400000);
  await page.waitForTimeout(2500);
  await shot('11-finish-unlock');
  const note = await page.textContent('.screen.finish');
  if (!/NEW TRACK UNLOCKED/.test(note)) errors.push('finish screen should announce the unlocked track');
  await page.click('[data-action="next"]');
  await waitFor(page, (id) => window.__game.race.track.id === id, cards[1].id);
} catch (e) {
  errors.push(String(e));
  await shot('zz-tracks-error').catch(() => {});
} finally {
  await browser.close();
  await server.close();
}
report('tracks', errors);
