// "Undo" for the things that are easy to do by accident: deleting and ticking.
import { state } from './state.js';
import { t } from './i18n.js';
import { showToast } from './ui.js';
import { restoreItemDoc, setBought } from './sync.js';

// `items` were just deleted from the active list.
export function showUndoDelete(items) {
  const listId = state.activeListId;
  showToast(t().deletedFn(items.length), {
    actionLabel: t().undoLabel,
    onAction: () => items.forEach((item) => restoreItemDoc(item, listId)),
  });
}

// `item` was just ticked (`nowBought` true) or un-ticked.
export function showUndoTick(item, nowBought) {
  const listId = state.activeListId;
  const text = nowBought ? t().boughtFn(item.name) : t().unboughtFn(item.name);
  showToast(text, {
    actionLabel: t().undoLabel,
    onAction: () => {
      if (state.activeListId !== listId) return;
      const current = state.items.find((i) => i.id === item.id);
      if (current && current.bought === nowBought) setBought(current, !nowBought);
    },
  });
}
