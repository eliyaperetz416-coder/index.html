// Expedition events and reputation. Pure logic.
//
// While state.expedition.event is set (e.g. { id: 'trader' }), the expedition waits for the player's choice.

import { EVENTS } from '../data/events.js';
import { PLANETS } from '../data/planets.js';
import { RACES, FRIENDLY, HOSTILE } from '../data/races.js';
import { canPay, pay } from './state.js';
import { shipStats } from './fleet.js';

/** Random number from 0 to 1. Uses state.seed so a saved game always continues the same way. */
export function random(state) {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function standing(rep) {
  if (rep >= FRIENDLY) return 'Friendly';
  if (rep <= HOSTILE) return 'Hostile';
  return 'Neutral';
}

/** Friendly locals help you gather (+50%); hostile ones get in the way (−50%). */
export function yieldBonus(state, planetId) {
  const rep = state.reputation[PLANETS[planetId].race];
  if (rep >= FRIENDLY) return 1.5;
  if (rep <= HOSTILE) return 0.5;
  return 1;
}

function changeRep(state, race, amount) {
  state.reputation[race] = Math.max(-100, Math.min(100, state.reputation[race] + amount));
}

/** Pick a random event that can happen on this planet and make the expedition wait for an answer. */
export function startEvent(state) {
  const e = state.expedition;
  const race = RACES[PLANETS[e.planet].race];
  const possible = Object.entries(EVENTS)
    .filter(([, ev]) => (!ev.planets || ev.planets.includes(e.planet)) && (!ev.needsEnemy || race.enemy))
    .map(([id]) => id);
  e.event = { id: possible[Math.floor(random(state) * possible.length)] };
}

/** The current event with {race} and {enemy} filled in, or null. */
export function currentEvent(state) {
  const e = state.expedition;
  if (!e?.event) return null;
  const race = RACES[PLANETS[e.planet].race];
  const fill = (text) => text.replaceAll('{race}', race.name).replaceAll('{enemy}', RACES[race.enemy]?.name ?? '');
  const ev = EVENTS[e.event.id];
  return {
    title: ev.title,
    text: fill(ev.text),
    fill,
    choices: ev.choices.map((c) => ({ ...c, label: fill(c.label), chance: choiceChance(state, c) })),
  };
}

const fleetAttack = (state) =>
  state.expedition.shipIds.reduce((sum, id) => sum + shipStats(state.ships.find((s) => s.id === id)).attack, 0);

/** Chance (0–1) that a choice succeeds. Fights depend on the fleet's total Attack. */
export function choiceChance(state, choice) {
  if (choice.fight) {
    const attack = fleetAttack(state);
    return Math.max(0.1, Math.min(0.9, attack / (attack + choice.fight)));
  }
  return choice.chance ?? 1;
}

export function canChoose(state, index) {
  const choice = EVENTS[state.expedition?.event?.id]?.choices[index];
  if (!choice) return { ok: false, reason: 'No such choice' };
  if (choice.cost && !canPay(state, choice.cost)) return { ok: false, reason: 'Not enough resources' };
  return { ok: true };
}

/**
 * Carry out the player's choice. Returns { won, text, changes: ['+8 cargo', 'Lumari +15', ...] },
 * or null if the choice was not allowed.
 */
export function resolveEvent(state, index) {
  if (!canChoose(state, index).ok) return null;
  const e = state.expedition;
  const event = currentEvent(state);
  const choice = EVENTS[e.event.id].choices[index];
  const planet = PLANETS[e.planet];
  const race = RACES[planet.race];
  if (choice.cost) pay(state, choice.cost);

  const won = random(state) < choiceChance(state, choice);
  const outcome = won || !choice.lose ? choice.win : choice.lose;
  const changes = [];

  if (outcome.loot) {
    const held = Object.values(e.loot).reduce((a, b) => a + b, 0);
    const added = Math.min(outcome.loot, Math.max(0, e.cargo - held));
    for (const id of planet.rare) e.loot[id] = (e.loot[id] ?? 0) + added / planet.rare.length;
    changes.push(added < outcome.loot ? `+${Math.round(added)} cargo (hold full)` : `+${added} cargo`);
  }
  if (outcome.lootLoss) {
    for (const id of Object.keys(e.loot)) e.loot[id] *= 1 - outcome.lootLoss;
    changes.push(`−${Math.round(outcome.lootLoss * 100)}% cargo`);
  }
  if (outcome.credits) {
    state.resources.credits += outcome.credits;
    changes.push(`+${outcome.credits} Credits`);
  }
  const rep = outcome.rep ?? {};
  const repChange = (id, amount) => {
    if (!id || !amount) return;
    changeRep(state, id, amount);
    changes.push(`${RACES[id].name} ${amount > 0 ? '+' : '−'}${Math.abs(amount)}`);
  };
  repChange(planet.race, rep.self);
  repChange(race.enemy, rep.enemy);
  if (rep.others) for (const id of Object.keys(RACES)) if (id !== planet.race) repChange(id, rep.others);

  if (outcome.time) {
    e.remaining = Math.max(0, e.remaining + outcome.time);
    changes.push(`${outcome.time > 0 ? '+' : '−'}${Math.abs(outcome.time)}s on site`);
  }
  if (outcome.endTrip) {
    e.phase = 'return';
    e.remaining = planet.travel;
    changes.push('Fleet heads home');
  }
  e.event = null;
  return { won, text: event.fill(outcome.text), changes };
}
