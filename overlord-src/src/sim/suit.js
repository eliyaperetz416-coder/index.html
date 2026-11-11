// The commander's own air supply. Outside, the suit tank drains; inside a room it
// refills from the base's oxygen. Pure logic.

export const SUIT = {
  seconds: 150, // how long a full tank lasts outside
  refill: 30, // percent per second while indoors
  baseCost: 0.04, // base Oxygen used per percent refilled (a full refill costs 4)
  staleAir: 0.3, // indoors with no base oxygen left, the tank still drains at this rate
  fine: 50, // credits lost to the medics when you black out
};

/**
 * @param indoors  true while the commander is inside a pressurised room
 * @returns 'blackout' on the step the tank runs dry, otherwise null
 */
export function tickSuit(state, dt, indoors) {
  const suit = state.suit;
  const r = state.resources;
  if (indoors && r.oxygen > 0) {
    const gain = Math.min(100 - suit.oxygen, SUIT.refill * dt, r.oxygen / SUIT.baseCost);
    suit.oxygen += gain;
    r.oxygen -= gain * SUIT.baseCost;
    return null;
  }
  suit.oxygen -= (100 / SUIT.seconds) * dt * (indoors ? SUIT.staleAir : 1);
  if (suit.oxygen > 0) return null;
  // The crew drags the commander back inside.
  suit.oxygen = 50;
  r.credits = Math.max(0, r.credits - SUIT.fine);
  state.stats.blackouts++;
  return 'blackout';
}
