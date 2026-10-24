// Bottom navigation: switch between the List screen and the Stats screen.
import { $ } from './util.js';
import { renderStats } from './stats.js';

export function initNav() {
  const navListBtn = $('navListBtn');
  const navStatsBtn = $('navStatsBtn');
  const listScreenEl = $('listScreen');
  const statsScreenEl = $('statsScreen');

  navListBtn.addEventListener('click', () => {
    navListBtn.classList.add('active');
    navStatsBtn.classList.remove('active');
    listScreenEl.classList.add('active');
    statsScreenEl.classList.remove('active');
  });

  navStatsBtn.addEventListener('click', () => {
    navStatsBtn.classList.add('active');
    navListBtn.classList.remove('active');
    statsScreenEl.classList.add('active');
    listScreenEl.classList.remove('active');
    renderStats();
  });
}
