// Full-screen 2D screens over the 3D view: notebook rules, the TV news puzzle, chapter end.
// Everything shown comes from data (rules file, chapter puzzles); this file only lays it out.
import { judge, rules as notebookRules } from './engine/rules.js';
import notebook from '../data/notebook-rules.json';
import { playSound } from './engine/audio.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const root = () => document.getElementById('screen');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(text, className = 'btn') {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
}

const clicked = (b) => new Promise((resolve) => b.addEventListener('click', resolve, { once: true }));

async function open(screen) {
  const r = root();
  r.replaceChildren(screen);
  r.classList.add('show');
  await wait(20);
  screen.classList.add('in');
}

async function close() {
  const r = root();
  r.classList.remove('show');
  await wait(450);
  r.replaceChildren();
}

// ---------------------------------------------------------------- notebook rules

export async function showRules() {
  const page = el('div', 'nb-page rules');
  page.append(el('div', 'nb-title', notebook.title));
  const list = el('ol', 'nb-rules');
  for (const rule of notebookRules) list.append(el('li', null, rule.text));
  page.append(list);
  const next = button('המשך');
  page.append(next);
  const screen = el('div', 'scr scr-notebook');
  screen.append(page);
  playSound('write', { duration: 0.4 });
  await open(screen);
  await clicked(next);
  await close();
}

// ---------------------------------------------------------------- portraits (no image files)

function portrait({ style, hair = '#222', skin = '#d8b498' }) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  const add = (name, attrs) => {
    const n = document.createElementNS(ns, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
  };
  add('rect', { width: 100, height: 100, fill: style === 'cctv' ? '#1c2a22' : '#2a3140' });
  add('path', { d: 'M14 100 Q16 74 50 70 Q84 74 86 100 Z', fill: '#3b3f4a' });
  add('rect', { x: 44, y: 58, width: 12, height: 14, fill: skin });
  add('ellipse', { cx: 50, cy: 44, rx: 19, ry: 23, fill: skin });
  add('path', { d: 'M30 42 Q30 18 50 18 Q71 18 70 42 Q64 30 50 29 Q38 30 30 42 Z', fill: hair });
  add('rect', { x: 39, y: 43, width: 8, height: 2.6, fill: '#1a1310' });
  add('rect', { x: 53, y: 43, width: 8, height: 2.6, fill: '#1a1310' });
  add('rect', { x: 45, y: 57, width: 10, height: 1.8, fill: '#7a4a40' });
  const frame = el('div', `portrait p-${style}`);
  frame.append(svg);
  if (style === 'live') frame.append(el('span', 'tag live', 'LIVE'));
  if (style === 'cctv') frame.append(el('span', 'tag cam', 'CAM 03  23:41'));
  return frame;
}

// ---------------------------------------------------------------- TV news puzzle

/**
 * Runs a "news" puzzle: pick a person to write in the notebook, the rules decide what happens.
 * Wrong picks explain the broken rule and let the player choose again.
 * Resolves with the chosen candidate's `success` outcome.
 */
export async function runNewsPuzzle(puzzle, { say }) {
  const screen = el('div', 'scr scr-tv');
  const tv = el('div', 'tv');
  const bar = el('div', 'tv-bar');
  bar.append(el('span', 'tv-channel', puzzle.channel), el('span', 'tv-headline', puzzle.headline));
  const grid = el('div', 'tv-grid');
  const ticker = el('div', 'tv-ticker');
  ticker.append(el('span', null, puzzle.ticker));
  tv.append(bar, grid, ticker);
  const prompt = el('div', 'tv-prompt', puzzle.prompt);
  screen.append(tv, prompt);

  const cards = puzzle.candidates.map((c) => {
    const card = button('', 'tv-card');
    card.append(portrait(c.portrait), el('div', 'tv-name', c.name), el('div', 'tv-caption', c.caption));
    grid.append(card);
    return { c, card };
  });

  playSound('tv');
  await open(screen);

  for (;;) {
    const pick = await Promise.race(cards.map(({ c, card }) => clicked(card).then(() => ({ c, card }))));
    cards.forEach(({ card }) => { card.disabled = true; });
    const verdict = judge(pick.c.facts);
    await writeInNotebook(screen, pick.c, verdict);
    if (verdict.works) {
      prompt.hidden = true;
      await breakingNews(tv, pick.c.success.news);
      await say({ speaker: 'לייט', thought: true, text: pick.c.success.thought, for: 2.6 });
      await close();
      return { ...pick.c.success, id: pick.c.id };
    }
    pick.card.classList.add('tried');
    cards.forEach(({ card }) => { card.disabled = card.classList.contains('tried'); });
  }
}

/** Notebook page sliding over the TV: writes the name (if possible), waits the 40 seconds, explains a failure. */
async function writeInNotebook(screen, candidate, verdict) {
  const sheet = el('div', 'nb-sheet');
  const page = el('div', 'nb-page lined');
  const line = el('div', 'nb-writing');
  page.append(line);
  sheet.append(page);
  screen.append(sheet);
  await wait(20);
  sheet.classList.add('in');
  await wait(450);

  if (verdict.canWrite) {
    const name = candidate.name;
    playSound('write', { duration: name.length * 0.09 });
    for (let i = 1; i <= name.length; i++) {
      line.textContent = name.slice(0, i);
      await wait(90);
    }
    await wait(400);
    const clock = el('div', 'nb-clock');
    page.append(clock);
    for (let s = 40; s >= 0; s -= 2) {
      clock.textContent = String(s);
      playSound('tick');
      await wait(s > 6 ? 110 : 320);
    }
    if (verdict.works) {
      clock.classList.add('done');
      await wait(500);
      sheet.classList.remove('in');
      await wait(450);
      sheet.remove();
      return;
    }
  } else {
    line.classList.add('empty');
    line.textContent = '?';
  }

  const box = el('div', 'nb-verdict');
  box.append(el('p', 'nb-fail', verdict.rule.fail), el('blockquote', null, verdict.rule.text));
  const again = button('בחר שם אחר');
  box.append(again);
  page.append(box);
  await clicked(again);
  sheet.classList.remove('in');
  await wait(450);
  sheet.remove();
}

async function breakingNews(tv, text) {
  playSound('impact');
  playSound('drone', { duration: 4 });
  const flash = el('div', 'tv-breaking');
  flash.append(el('span', 'tv-badge', 'מבזק'), el('p', null, text));
  tv.append(flash);
  await wait(20);
  flash.classList.add('in');
  await wait(3600);
}

// ---------------------------------------------------------------- chapter end

export async function showEnd({ title, summary, before, after }) {
  const screen = el('div', 'scr scr-end');
  screen.append(el('div', 'end-title', title));
  if (summary) screen.append(el('p', 'end-summary', summary));
  const meter = el('div', 'meter');
  const label = el('div', 'meter-label');
  label.append(el('span', null, 'החשד של L'), el('b', 'meter-value', String(before)));
  const track = el('div', 'meter-track');
  const fill = el('div', 'meter-fill');
  fill.style.width = `${before}%`;
  track.append(fill);
  meter.append(label, track);
  screen.append(meter);
  await open(screen);
  await wait(900);
  fill.style.width = `${after}%`;
  const value = label.querySelector('.meter-value');
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    value.textContent = String(Math.round(before + ((after - before) * i) / steps));
    await wait(40);
  }
  if (after > before) {
    const delta = el('span', 'meter-delta', `+${after - before}`);
    label.append(delta);
  }
}
