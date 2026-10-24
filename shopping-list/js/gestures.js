// The arithmetic of swiping a list row (no DOM, so it can be unit tested).
export const SWIPE_START = 10;   // px before a drag counts as horizontal
export const SWIPE_MIN = 72;     // px needed to trigger, at least
export const SWIPE_MAX = 140;    // the row never follows the finger further

// Clearly sideways (not a diagonal scroll), and past the start distance.
export function isHorizontalDrag(dx, dy) {
  return Math.abs(dx) > SWIPE_START && Math.abs(dx) > Math.abs(dy) * 1.5;
}

// Positive = toward the end of the line (right in English, left in Hebrew / Arabic).
export function logicalOffset(dx, dir) {
  return dir === 'rtl' ? -dx : dx;
}

// Toward the end of the line ticks the item, toward the start deletes it.
export function swipeOutcome(dx, { dir, width }) {
  const needed = Math.max(SWIPE_MIN, width * 0.3);
  const offset = logicalOffset(dx, dir);
  if (offset >= needed) return 'tick';
  if (offset <= -needed) return 'delete';
  return null;
}

export function clampOffset(dx) {
  return Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx));
}
