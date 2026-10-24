// Stats screen (weekly purchase patterns) and smart suggestions, both computed
// locally from purchaseHistory.
import { state } from './state.js';
import { t } from './i18n.js';
import { $ } from './util.js';
import { escapeHtml } from './html.js';
import { categoryColor } from './category.js';
import { computeStats, DAY_MS } from './stats-calc.js';

// The texts that depend on the chosen period (week / month).
function periodTexts(period) {
  const dict = t();
  return period === 'month'
    ? { total: dict.statsMonthTotal, chart: dict.statsChartTitleMonth, first: dict.statsFirstMonth, more: dict.statsMoreThanLastMonth, less: dict.statsLessThanLastMonth, same: dict.statsSameAsLastMonth }
    : { total: dict.statsWeekTotal, chart: dict.statsChartTitle, first: dict.statsFirstWeek, more: dict.statsMoreThanLastWeek, less: dict.statsLessThanLastWeek, same: dict.statsSameAsLastWeek };
}

export function renderStats() {
  renderSuggestions();

  const period = state.statsPeriod;
  const stats = computeStats(state.purchaseHistory, period);
  const texts = periodTexts(period);

  document.querySelectorAll('#statsPeriod button').forEach((btn) => {
    btn.setAttribute('aria-checked', String(btn.dataset.period === period));
    btn.textContent = btn.dataset.period === 'month' ? t().periodMonth : t().periodWeek;
  });
  $('statsWeekTotalLabel').textContent = texts.total;
  $('statsChartTitle').textContent = texts.chart;
  $('statsTopItemsTitle').textContent = t().statsTopItemsTitle;
  $('statsWeekTotalValue').textContent = stats.total;
  $('statsTopCategoryValue').textContent = stats.topCategory ? t().categories[stats.topCategory] : '–';

  // Comparison with the period before
  const compareBox = $('statsCompareBox');
  if (stats.previousTotal === 0 && stats.total === 0) {
    compareBox.innerHTML = `<span>📊</span><span>${t().statsNoDataYet}</span>`;
  } else if (stats.previousTotal === 0) {
    compareBox.innerHTML = `<span>🆕</span><span>${texts.first}</span>`;
  } else if (stats.diff > 0) {
    compareBox.innerHTML = `<span>📈</span><span>${texts.more(stats.diff)}</span>`;
  } else if (stats.diff < 0) {
    compareBox.innerHTML = `<span>📉</span><span>${texts.less(-stats.diff)}</span>`;
  } else {
    compareBox.innerHTML = `<span>➖</span><span>${texts.same}</span>`;
  }

  // Bars by category
  const chartEl = $('statsChart');
  if (stats.byCategory.length === 0) {
    chartEl.innerHTML = `<div class="stats-empty">${t().statsEmptyChart}</div>`;
  } else {
    const maxCount = stats.byCategory[0].count;
    chartEl.innerHTML = stats.byCategory.map(({ catKey, count }) => {
      const widthPct = Math.max(6, Math.round((count / maxCount) * 100));
      return `
        <div class="stats-bar-row">
          <span class="stats-bar-label">${escapeHtml(t().categories[catKey])}</span>
          <div class="stats-bar-track">
            <div class="stats-bar-fill" style="width:${widthPct}%; background:${categoryColor(catKey)}"></div>
          </div>
          <span class="stats-bar-count">${count}</span>
        </div>
      `;
    }).join('');
  }

  // The most bought items
  $('statsTopItems').innerHTML = stats.topItems.length === 0
    ? `<li class="stats-empty">${t().statsEmptyChart}</li>`
    : stats.topItems.map((item) => `
        <li class="top-item" style="--cat-color:${categoryColor(item.catKey)}">
          <span class="top-item-dot"></span>
          <span class="top-item-name">${escapeHtml(item.name)}</span>
          <span class="top-item-count">×${item.count}</span>
        </li>`).join('');
}

// ============================================================
// SMART SUGGESTIONS: detect items bought on a consistent, repeating interval
// ============================================================
const MIN_PURCHASES_FOR_HABIT = 4; // need at least this many recorded purchases of an item
const MAX_SUGGESTIONS = 6;

// A habit is "consistent" if the gaps between purchases don't vary too wildly —
// measured as the gaps' standard deviation relative to their average (coefficient
// of variation). A lower ratio means a more regular rhythm.
function detectHabits() {
  // Group purchase history by item name (case-insensitive, trimmed)
  const byName = new Map();
  state.purchaseHistory.forEach(p => {
    if (typeof p.name !== 'string') return;
    const key = p.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p);
  });

  const habits = [];
  byName.forEach((purchases) => {
    if (purchases.length < MIN_PURCHASES_FOR_HABIT) return;

    const sorted = [...purchases].sort((a, b) => a.timestamp - b.timestamp);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((sorted[i].timestamp - sorted[i - 1].timestamp) / DAY_MS);
    }

    const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    if (avgGap <= 0) return;
    const variance = gaps.reduce((sum, g) => sum + (g - avgGap) ** 2, 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    const consistency = stdDev / avgGap; // lower = more consistent rhythm

    // Only treat it as a real habit if the rhythm is reasonably regular
    if (consistency > 0.6) return;

    const latest = sorted[sorted.length - 1];
    const daysSinceLast = (Date.now() - latest.timestamp) / DAY_MS;

    // Only suggest it if we're at or past the point where it'd usually be bought again
    if (daysSinceLast < avgGap * 0.7) return;

    habits.push({ name: latest.name, avgGap });
  });

  // Most "due" first (furthest past their expected interval)
  return habits.sort((a, b) => b.avgGap - a.avgGap).slice(0, MAX_SUGGESTIONS);
}

function renderSuggestions() {
  const card = $('suggestionsCard');
  const listEl = $('suggestionsList');
  const habits = detectHabits();

  if (habits.length === 0) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  listEl.innerHTML = habits.map(habit => {
    // Skip suggesting something already sitting in the active list, unbought
    const alreadyInList = state.items.some(i => !i.bought && typeof i.name === 'string' && i.name.trim().toLowerCase() === habit.name.trim().toLowerCase());
    return `
      <button class="suggestion-chip${alreadyInList ? ' added' : ''}" data-name="${escapeHtml(habit.name)}">
        <span class="plus">${alreadyInList ? '✓' : '+'}</span>${escapeHtml(habit.name)}
      </button>
    `;
  }).join('');
}

// `onPick(name)` adds the suggested item to the list.
export function initStats(onPick) {
  $('statsPeriod').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-period]');
    if (!btn || btn.dataset.period === state.statsPeriod) return;
    state.statsPeriod = btn.dataset.period;
    localStorage.setItem('statsPeriod', state.statsPeriod);
    renderStats();
  });

  $('suggestionsList').addEventListener('click', (e) => {
    const chip = e.target.closest('.suggestion-chip');
    if (!chip || chip.classList.contains('added')) return;
    onPick(chip.dataset.name);
    chip.classList.add('added');
    chip.querySelector('.plus').textContent = '✓';
  });
}
