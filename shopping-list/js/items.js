// Pure item/purchase-history logic (no DOM, no Firebase) so it can be unit tested.
export const PURCHASE_HISTORY_LIMIT = 500;

function sameInstant(entry, item) {
  if (entry.timestamp !== item.boughtAt) return false;
  // New entries carry the item id; entries written by older versions only have the name.
  return entry.itemId ? entry.itemId === item.id : entry.name === item.name;
}

// Flips an item between bought / not bought and keeps purchaseHistory in step:
// buying appends one purchase, un-buying removes the purchase that buying created.
// Returns new arrays; the inputs are not modified.
export function toggleBought(items, purchaseHistory, id, now = Date.now()) {
  const target = items.find((i) => i.id === id);
  if (!target) return { items: [...items], purchaseHistory: [...purchaseHistory] };

  let history = [...purchaseHistory];
  let updated;
  if (!target.bought) {
    updated = { ...target, bought: true, boughtAt: now };
    history.push({
      itemId: target.id,
      name: target.name,
      catKey: target.catKey,
      catColor: target.catColor,
      timestamp: now,
    });
    if (history.length > PURCHASE_HISTORY_LIMIT) history = history.slice(-PURCHASE_HISTORY_LIMIT);
  } else {
    const at = history.findIndex((e) => sameInstant(e, target));
    if (at !== -1) history.splice(at, 1);
    updated = { ...target, bought: false, boughtAt: null };
  }
  return { items: items.map((i) => (i.id === id ? updated : i)), purchaseHistory: history };
}
