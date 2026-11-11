// The war between the Lumari and the Drakh. Pure logic.
//
// state.war = {
//   front     -100 … +100: positive means the Lumari are winning, negative the Drakh
//   timer     seconds until the next thing happens (a battle starts, or the offer runs out)
//   offer     null, or { strength: 1–3 } while a battle is open for you to join
//   battle    null, or the battle you are fighting (see joinBattle)
//   ended     null, or the race that won the war (when the front reaches ±100)
// }

import { WAR } from '../data/war.js';
import { PLANETS } from '../data/planets.js';
import { RACES } from '../data/races.js';
import { shipStats, shipBusy } from './fleet.js';
import { random } from './events.js';

const [POSITIVE, NEGATIVE] = WAR.sides;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const enemyOf = (side) => RACES[side].enemy;
const towards = (side) => (side === POSITIVE ? 1 : -1);

function shiftFront(state, side, amount) {
  state.war.front = clamp(state.war.front + towards(side) * amount, -100, 100);
}

function changeRep(state, race, amount) {
  state.reputation[race] = clamp(state.reputation[race] + amount, -100, 100);
}

/** Who is ahead: 'lumari', 'drakh' or null when the front is balanced. */
export function leader(state) {
  if (state.war.front >= 10) return POSITIVE;
  if (state.war.front <= -10) return NEGATIVE;
  return null;
}

export function canJoinBattle(state, side, shipIds) {
  if (!state.war.offer) return { ok: false, reason: 'No battle to join right now' };
  if (!WAR.sides.includes(side)) return { ok: false, reason: 'Pick a side' };
  if (shipIds.length === 0) return { ok: false, reason: 'Pick at least one ship' };
  for (const id of shipIds) {
    if (!state.ships.some((s) => s.id === id)) return { ok: false, reason: 'No such ship' };
    if (shipBusy(state, id)) return { ok: false, reason: 'One of those ships is away' };
  }
  return { ok: true };
}

/** Commit ships to the open battle on one side. */
export function joinBattle(state, side, shipIds) {
  if (!canJoinBattle(state, side, shipIds).ok) return false;
  const { strength } = state.war.offer;
  state.war.offer = null;
  state.war.timer = WAR.roundTime;
  state.war.battle = {
    side,
    strength,
    round: 0,
    ships: shipIds.map((id) => {
      const stats = shipStats(state.ships.find((s) => s.id === id));
      return { id, hp: stats.hull, maxHp: stats.hull, attack: stats.attack };
    }),
    enemyHp: WAR.enemyHull * strength,
    enemyMax: WAR.enemyHull * strength,
    order: null, // 'focus' or 'shields' for the coming round
    cooldown: { focus: 0, shields: 0 }, // rounds until each order can be used again
    log: `You join the ${RACES[side].name} line against the ${RACES[enemyOf(side)].name}.`,
  };
  return true;
}

export function canOrder(state, order) {
  const b = state.war.battle;
  return !!b && order in b.cooldown && b.cooldown[order] === 0 && !b.order;
}

/** Give an order for the next round: 'focus' (hit harder, get hit harder) or 'shields' (take far less damage). */
export function giveOrder(state, order) {
  if (!canOrder(state, order)) return false;
  state.war.battle.order = order;
  return true;
}

function endBattle(state, result) {
  state.war.battle = null;
  state.war.timer = WAR.gap;
  return result;
}

/** Pull out of the battle. Your side holds it against you a little, and the enemy takes the field. */
export function retreat(state) {
  const b = state.war.battle;
  if (!b) return null;
  changeRep(state, b.side, WAR.retreatRep);
  shiftFront(state, enemyOf(b.side), WAR.ignoredShift);
  return endBattle(state, { type: 'retreated', side: b.side, changes: [`${RACES[b.side].name} −${-WAR.retreatRep}`] });
}

/** Fight one round. Returns a 'round', 'won' or 'lost' event. */
function fightRound(state) {
  const b = state.war.battle;
  const enemy = RACES[enemyOf(b.side)].name;
  b.round++;
  const alive = b.ships.filter((s) => s.hp > 0);

  // Your side shoots.
  const power = alive.reduce((sum, s) => sum + s.attack, 0) * (b.order === 'focus' ? WAR.focusDamage : 1) + WAR.allyAttack;
  const dealt = Math.round(power * (0.8 + 0.4 * random(state)));
  b.enemyHp = Math.max(0, b.enemyHp - dealt);

  if (b.enemyHp <= 0) {
    const s = b.strength;
    const rep = WAR.rep[0] + WAR.rep[1] * s;
    const loot = {};
    const home = Object.values(PLANETS).find((p) => p.race === b.side);
    for (const id of home.rare) {
      loot[id] = WAR.loot * s;
      state.rare[id] += loot[id];
    }
    state.resources.credits += WAR.credits * s;
    changeRep(state, b.side, rep);
    changeRep(state, enemyOf(b.side), -rep);
    shiftFront(state, b.side, WAR.front[0] + WAR.front[1] * s);
    state.stats.battlesWon++;
    return endBattle(state, {
      type: 'won',
      side: b.side,
      loot,
      changes: [`+${WAR.credits * s} Credits`, `${RACES[b.side].name} +${rep}`, `${enemy} −${rep}`],
    });
  }

  // The enemy shoots back at one of your ships.
  const target = alive[Math.floor(random(state) * alive.length)];
  const taken = Math.round(
    WAR.enemyAttack * b.strength * (b.order === 'shields' ? WAR.shieldBlock : 1) * (b.order === 'focus' ? WAR.focusRisk : 1),
  );
  target.hp = Math.max(0, target.hp - taken);
  b.log = `Round ${b.round}: you deal ${dealt}, the ${enemy} deal ${taken}.`;
  if (target.hp <= 0) {
    state.ships = state.ships.filter((s) => s.id !== target.id); // the ship is gone for good
    b.log += ' A ship is lost!';
  }

  for (const key of Object.keys(b.cooldown)) b.cooldown[key] = Math.max(0, b.cooldown[key] - 1);
  if (b.order) b.cooldown[b.order] = WAR.cooldown;
  b.order = null;

  if (b.ships.every((s) => s.hp <= 0)) {
    shiftFront(state, enemyOf(b.side), WAR.front[0] + WAR.front[1] * b.strength);
    changeRep(state, b.side, WAR.rep[1]); // they saw you die for them
    return endBattle(state, { type: 'lost', side: b.side, changes: [`${RACES[b.side].name} +${WAR.rep[1]}`, 'Fleet destroyed'] });
  }
  return { type: 'round' };
}

/**
 * Advance the war by dt seconds. Returns what just happened, if anything:
 * { type: 'offer' | 'ignored' | 'round' | 'won' | 'lost' | 'ended', ... }
 * When this step ended the war, the event also has `ended` set to the winning race.
 */
export function tickWar(state, dt) {
  const war = state.war;
  if (war.ended) return null;
  const event = advanceWar(state, dt);
  // The front can also be pushed to the end by a retreat, between ticks.
  if (Math.abs(war.front) < 100) return event;
  war.ended = war.front > 0 ? POSITIVE : NEGATIVE;
  war.offer = null;
  return { ...(event ?? { type: 'ended' }), ended: war.ended };
}

function advanceWar(state, dt) {
  const war = state.war;
  war.timer -= dt;
  if (war.timer > 0) return null;

  if (war.battle) {
    war.timer = WAR.roundTime;
    return fightRound(state);
  }
  if (war.offer) {
    // Nobody asked you: the battle is fought without you and the front moves on its own.
    war.offer = null;
    war.timer = WAR.gap;
    const winner = random(state) < 0.5 ? POSITIVE : NEGATIVE;
    shiftFront(state, winner, WAR.ignoredShift);
    return { type: 'ignored', winner };
  }
  war.offer = { strength: 1 + Math.floor(random(state) * 3) };
  war.timer = WAR.offerTime;
  return { type: 'offer', strength: war.offer.strength };
}
