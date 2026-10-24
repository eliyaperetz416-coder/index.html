// Stats screen (weekly purchase patterns) and smart suggestions, both computed
// locally from purchaseHistory.
import { state } from './state.js';
import { t } from './i18n.js';
import { $, DAY_MS } from './util.js';
import { escapeHtml } from './html.js';
import { safeCategoryKey, categoryColor } from './category.js';

function purchasesInRange(startMs, endMs) {
  return state.purchaseHistory.filter(p => p.timestamp >= startMs && p.timestamp < endMs);
}

export function renderStats() {
  renderSuggestions();

  const now = Date.now();
  const thisWeekStart = now - 7 * DAY_MS;
  const lastWeekStart = now - 14 * DAY_MS;

  const thisWeek = purchasesInRange(thisWeekStart, now);
  const lastWeek = purchasesInRange(lastWeekStart, thisWeekStart);

  // Total items this week
  $('statsWeekTotalValue').textContent = thisWeek.length;

  // Category breakdown this week
  const byCategory = {}; // catKey -> { count, color }
  thisWeek.forEach(p => {
    const key = safeCategoryKey(p.catKey);
    if (!byCategory[key]) byCategory[key] = { count: 0, color: categoryColor(key) };
    byCategory[key].count++;
  });
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].count - a[1].count);

  // Top category
  const topCategoryEl = $('statsTopCategoryValue');
  if (sortedCategories.length > 0) {
    const [topKey] = sortedCategories[0];
    topCategoryEl.textContent = t().categories[topKey];
  } else {
    topCategoryEl.textContent = '–';
  }

  // Week-over-week comparison
  const compareBox = $('statsCompareBox');
  if (lastWeek.length === 0 && thisWeek.length === 0) {
    compareBox.innerHTML = `<span>📊</span><span>${t().statsNoDataYet}</span>`;
  } else if (lastWeek.length === 0) {
    compareBox.innerHTML = `<span>🆕</span><span>${t().statsFirstWeek}</span>`;
  } else {
    const diff = thisWeek.length - lastWeek.length;
    if (diff > 0) {
      compareBox.innerHTML = `<span>📈</span><span>${t().statsMoreThanLastWeek(diff)}</span>`;
    } else if (diff < 0) {
      compareBox.innerHTML = `<span>📉</span><span>${t().statsLessThanLastWeek(Math.abs(diff))}</span>`;
    } else {
      compareBox.innerHTML = `<span>➖</span><span>${t().statsSameAsLastWeek}</span>`;
    }
  }

  // Simple bar chart by category
  const chartEl = $('statsChart');
  if (sortedCategories.length === 0) {
    chartEl.innerHTML = `<div class="stats-empty">${t().statsEmptyChart}</div>`;
    return;
  }
  const maxCount = sortedCategories[0][1].count;
  chartEl.innerHTML = sortedCategories.map(([key, data]) => {
    const label = t().categories[key];
    const widthPct = Math.max(6, Math.round((data.count / maxCount) * 100));
    return `
      <div class="stats-bar-row">
        <span class="stats-bar-label">${escapeHtml(label)}</span>
        <div class="stats-bar-track">
          <div class="stats-bar-fill" style="width:${widthPct}%; background:${data.color}"></div>
        </div>
        <span class="stats-bar-count">${data.count}</span>
      </div>
    `;
  }).join('');
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
  $('suggestionsList').addEventListener('click', (e) => {
    const chip = e.target.closest('.suggestion-chip');
    if (!chip || chip.classList.contains('added')) return;
    onPick(chip.dataset.name);
    chip.classList.add('added');
    chip.querySelector('.plus').textContent = '✓';
  });
}
