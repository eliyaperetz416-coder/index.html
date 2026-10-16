// Tiny DOM helpers for the UI layer.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** HTML string to element (first element of the string). */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function fmtTime(t) {
  if (!Number.isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function fmtCoins(n) {
  return Math.round(n).toLocaleString('en-US');
}

/** Coin icon markup (CSS-drawn). */
export const COIN = '<i class="coin"></i>';

/** Sets textContent only when it changes (cheap per-frame updates). */
export function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}
