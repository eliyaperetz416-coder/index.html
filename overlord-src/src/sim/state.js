// The game rules. Pure logic: no 3D, no DOM — so it can be unit-tested and saved as plain JSON.

import { BASIC, RARE, STARTING, CREW } from '../data/resources.js';
import { MODULES, GRID_RADIUS } from '../data/modules.js';

export function createState() {
  return {
    version: 1,
    time: 0,
    resources: { ...STARTING },
    rare: Object.fromEntries(RARE.map((r) => [r.id, 0])),
    modules: [{ id: 1, type: 'core', x: 0, z: 0 }],
    ships: [], // { id, type, level }
    queue: [], // ships being built: { type, remaining seconds }
    nextId: 2,
    // How well the base ran on the last tick (1 = perfect).
    status: { power: 1, life: 1 },
  };
}

/** Totals over every module in the base. */
export function summarize(state) {
  const sum = { crew: 0, cap: 0, energyProd: 0, energyDemand: 0, produces: { metal: 0, oxygen: 0, food: 0 } };
  for (const m of state.modules) {
    const def = MODULES[m.type];
    sum.crew += def.crew ?? 0;
    sum.cap += def.storage ?? 0;
    sum.energyDemand += def.energy ?? 0;
    for (const [res, amount] of Object.entries(def.produces ?? {})) {
      if (res === 'energy') sum.energyProd += amount;
      else sum.produces[res] += amount;
    }
  }
  return sum;
}

/**
 * Advance the base by dt seconds.
 * - Not enough energy → powered modules slow down in proportion.
 * - Out of oxygen or food → the crew can barely work and everything runs at half speed.
 */
export function tick(state, dt) {
  const sum = summarize(state);
  const r = state.resources;

  const life = r.oxygen <= 0 || r.food <= 0 ? 0.5 : 1;
  const need = sum.energyDemand * dt;
  const available = r.energy + sum.energyProd * dt;
  const power = need > 0 ? Math.min(1, available / need) : 1;
  const eff = power * life;

  r.energy = available - need * power;
  for (const res of ['metal', 'oxygen', 'food']) r[res] += sum.produces[res] * eff * dt;
  r.oxygen -= sum.crew * CREW.oxygen * dt;
  r.food -= sum.crew * CREW.food * dt;
  r.credits += sum.crew * CREW.credits * life * dt;

  for (const b of BASIC) {
    r[b.id] = Math.max(0, b.uncapped ? r[b.id] : Math.min(sum.cap, r[b.id]));
  }
  state.status = { power, life };
  state.time += dt;
}

/** Net change per second of each basic resource, for the HUD. */
export function rates(state) {
  const sum = summarize(state);
  const { power, life } = state.status;
  const eff = power * life;
  return {
    metal: sum.produces.metal * eff,
    energy: sum.energyProd - sum.energyDemand * power,
    oxygen: sum.produces.oxygen * eff - sum.crew * CREW.oxygen,
    food: sum.produces.food * eff - sum.crew * CREW.food,
    credits: sum.crew * CREW.credits * life,
  };
}

/** Things the commander should worry about right now. */
export function alerts(state) {
  const out = [];
  const r = state.resources;
  const rate = rates(state);
  if (r.oxygen <= 0) out.push('No oxygen — crew at half strength');
  else if (rate.oxygen < 0 && r.oxygen / -rate.oxygen < 60) out.push('Oxygen running out');
  if (r.food <= 0) out.push('No food — crew at half strength');
  else if (rate.food < 0 && r.food / -rate.food < 60) out.push('Food running out');
  if (state.status.power < 1) out.push('Not enough energy — modules slowed');
  return out;
}

export function moduleAt(state, x, z) {
  return state.modules.find((m) => m.x === x && m.z === z);
}

/** cost looks like { metal: 30, credits: 10 } */
export function canPay(state, cost) {
  return Object.entries(cost).every(([res, amount]) => state.resources[res] >= amount);
}

export function pay(state, cost) {
  for (const [res, amount] of Object.entries(cost)) state.resources[res] -= amount;
}

export const canAfford = (state, type) => canPay(state, MODULES[type].cost);

/** Modules snap together: a new one must touch an existing one (up/down/left/right). */
export function canPlace(state, type, x, z) {
  if (!MODULES[type] || type === 'core') return { ok: false, reason: 'Cannot build that' };
  if (Math.abs(x) > GRID_RADIUS || Math.abs(z) > GRID_RADIUS) return { ok: false, reason: 'Outside the build zone' };
  if (moduleAt(state, x, z)) return { ok: false, reason: 'Spot taken' };
  const touching = state.modules.some((m) => Math.abs(m.x - x) + Math.abs(m.z - z) === 1);
  if (!touching) return { ok: false, reason: 'Must connect to the base' };
  if (!canAfford(state, type)) return { ok: false, reason: 'Not enough resources' };
  return { ok: true };
}

/** Pay for and add a module. Returns the new module, or null if it was not allowed. */
export function placeModule(state, type, x, z) {
  if (!canPlace(state, type, x, z).ok) return null;
  pay(state, MODULES[type].cost);
  const module = { id: state.nextId++, type, x, z };
  state.modules.push(module);
  return module;
}
