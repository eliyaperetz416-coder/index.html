// The War panel: the front line, joining a battle, and giving orders during one.

import { RACES } from '../data/races.js';
import { SHIPS } from '../data/ships.js';
import { WAR } from '../data/war.js';
import { canJoinBattle, canOrder, leader } from '../sim/war.js';
import { shipBusy } from '../sim/fleet.js';
import { el } from './dom.js';
import { lootText } from './mapPanel.js';

const [A, B] = WAR.sides; // A wins at front +100, B at -100
const secs = (n) => `${Math.ceil(Math.max(0, n))}s`;
const STRENGTH = ['', 'Skirmish', 'Battle', 'Major battle'];
const RESULT_TITLES = { won: 'Victory!', lost: 'Defeat', retreated: 'Retreated' };

/** One-line summary of the war for the menu card and the top of the screen. */
export function warLine(state) {
  const war = state.war;
  if (war.ended) return `${RACES[war.ended].name} won the war`;
  if (war.battle) return `In battle · round ${war.battle.round + 1}`;
  if (war.offer) return `Battle open · ${secs(war.timer)} to join`;
  const ahead = leader(state);
  return ahead ? `${RACES[ahead].name} are winning` : 'Front is balanced';
}

/**
 * @param onJoin    called with (side, shipIds)
 * @param onOrder   called with 'focus' or 'shields'
 * @param onRetreat called when the player pulls out
 */
export function createWarPanel({ onJoin, onOrder, onRetreat }) {
  const panel = el('div', 'panel war');
  panel.hidden = true;
  const title = el('h3', null, `${RACES[A].name} – ${RACES[B].name} War`);

  // The front line: a bar split between the two sides.
  const front = el('div', 'front');
  front.style.setProperty('--a', RACES[A].color);
  front.style.setProperty('--b', RACES[B].color);
  const frontFill = el('div');
  front.append(frontFill);
  const frontLabel = el('div', 'front-label');
  const body = el('div', 'panel-body');
  panel.append(title, front, frontLabel, body);

  let side = null; // the player's picks for the open battle
  const picked = new Set();
  let result = null; // the last battle's outcome, shown until the next battle opens
  let last = null;
  let drawn = '';
  let live = {}; // elements refreshed every tick

  panel.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button || !last) return;
    const d = button.dataset;
    if (d.side) side = d.side;
    if (d.ship) picked.has(Number(d.ship)) ? picked.delete(Number(d.ship)) : picked.add(Number(d.ship));
    if (d.join) onJoin(side, [...picked]);
    if (d.order) onOrder(d.order);
    if (d.retreat) onRetreat();
    update(last);
  });

  function renderOffer(state) {
    const nodes = [];
    live = { timer: el('p', 'muted') };
    nodes.push(el('h4', 'war-title', `${STRENGTH[state.war.offer.strength]} at the front`), live.timer);
    nodes.push(el('p', 'muted', `Enemy fleet: ${WAR.enemyHull * state.war.offer.strength} hull, ${WAR.enemyAttack * state.war.offer.strength} damage per round. Ships that are destroyed are gone for good.`));

    const sides = el('div', 'build-row');
    for (const id of WAR.sides) {
      const button = el('button', 'btn side');
      button.dataset.side = id;
      button.style.setProperty('--c', RACES[id].color);
      button.classList.toggle('active', side === id);
      button.append(el('strong', null, `Fight for the ${RACES[id].name}`), el('em', null, `against the ${RACES[RACES[id].enemy].name}`));
      sides.append(button);
    }
    nodes.push(sides);

    const free = state.ships.filter((s) => !shipBusy(state, s.id));
    if (free.length === 0) nodes.push(el('p', 'muted', 'You have no ships at the base to send.'));
    else {
      const ships = el('div', 'ship-picks');
      for (const ship of free) {
        const chip = el('button', 'pick', `${SHIPS[ship.type].name} L${ship.level}`);
        chip.dataset.ship = ship.id;
        chip.style.setProperty('--c', SHIPS[ship.type].color);
        chip.classList.toggle('active', picked.has(ship.id));
        ships.append(chip);
      }
      nodes.push(ships);
    }

    const check = canJoinBattle(state, side, [...picked]);
    const join = el('button', 'btn launch join');
    join.dataset.join = '1';
    join.classList.toggle('poor', !check.ok);
    join.append(el('strong', null, check.ok ? 'Join the battle' : check.reason));
    nodes.push(join);
    return nodes;
  }

  function renderBattle(state) {
    const b = state.war.battle;
    const enemy = RACES[RACES[b.side].enemy];
    live = { enemyBar: el('div'), enemyText: el('span'), log: el('p', 'battle-log'), ships: [], orders: {} };

    const foe = el('div', 'hp-row');
    foe.style.setProperty('--c', enemy.color);
    const foeBar = el('div', 'progress');
    foeBar.append(live.enemyBar);
    foe.append(el('strong', null, `${enemy.name} fleet`), foeBar, live.enemyText);
    const nodes = [el('h4', 'war-title', `Fighting for the ${RACES[b.side].name}`), foe];

    for (const ship of b.ships) {
      const row = el('div', 'hp-row');
      const def = SHIPS[state.ships.find((s) => s.id === ship.id)?.type] ?? { name: 'Lost ship', color: '#666c8f' };
      row.style.setProperty('--c', def.color);
      const bar = el('div', 'progress');
      const fill = el('div');
      bar.append(fill);
      const text = el('span');
      row.append(el('strong', null, def.name), bar, text);
      live.ships.push({ ship, fill, text, row });
      nodes.push(row);
    }
    nodes.push(live.log);

    const orders = el('div', 'build-row');
    for (const [id, name, desc] of [
      ['focus', 'Focus fire', 'Double damage, take more'],
      ['shields', 'Shields', 'Take far less damage'],
    ]) {
      const button = el('button', 'btn');
      button.dataset.order = id;
      const note = el('em');
      button.append(el('strong', null, name), el('span', null, desc), note);
      live.orders[id] = { button, note };
      orders.append(button);
    }
    const out = el('button', 'btn');
    out.dataset.retreat = '1';
    out.append(el('strong', null, 'Retreat'), el('span', null, 'Save your ships'));
    orders.append(out);
    nodes.push(orders);
    return nodes;
  }

  function renderQuiet(state) {
    live = { timer: el('p', 'muted') };
    const nodes = [];
    if (result) {
      const box = el('div', `war-result ${result.type}`);
      box.append(el('h4', null, RESULT_TITLES[result.type]));
      const changes = el('div', 'changes');
      const all = [...result.changes];
      if (result.loot) all.push(`+${lootText(result.loot)}`);
      for (const change of all) changes.append(el('b', /−|destroyed/.test(change) ? 'bad' : null, change));
      box.append(changes);
      nodes.push(box);
    }
    nodes.push(live.timer);
    if (!state.war.ended) nodes.push(el('p', 'muted', 'Join battles to push the front, earn reputation with one side and lose it with the other. Push the front to the end and the war is won.'));
    return nodes;
  }

  function update(state) {
    last = state;
    const war = state.war;
    for (const id of [...picked]) if (!state.ships.some((s) => s.id === id) || shipBusy(state, id)) picked.delete(id);

    frontFill.style.width = `${50 + war.front / 2}%`;
    const ahead = leader(state);
    frontLabel.textContent = ahead ? `${RACES[ahead].name} are winning (${Math.abs(war.front)})` : 'The front is balanced';

    const mode = war.battle ? 'battle' : war.offer ? 'offer' : 'quiet';
    if (mode === 'offer') result = null;
    const signature = JSON.stringify([
      mode,
      mode === 'offer' && [side, [...picked], state.ships.map((s) => [s.id, s.level, shipBusy(state, s.id)])],
      mode === 'battle' && war.battle.ships.length,
      result,
      war.ended,
    ]);
    if (signature !== drawn) {
      drawn = signature;
      body.replaceChildren(...(mode === 'battle' ? renderBattle(state) : mode === 'offer' ? renderOffer(state) : renderQuiet(state)));
    }

    if (mode === 'offer') live.timer.textContent = `${secs(war.timer)} left to join.`;
    if (mode === 'quiet') live.timer.textContent = war.ended ? `The war is over. The ${RACES[war.ended].name} have won.` : `Next battle in ${secs(war.timer)}.`;
    if (mode === 'battle') {
      const b = war.battle;
      live.enemyBar.style.width = `${(100 * b.enemyHp) / b.enemyMax}%`;
      live.enemyText.textContent = `${b.enemyHp}/${b.enemyMax}`;
      live.log.textContent = b.log;
      for (const { ship, fill, text, row } of live.ships) {
        fill.style.width = `${(100 * ship.hp) / ship.maxHp}%`;
        text.textContent = ship.hp > 0 ? `${ship.hp}/${ship.maxHp}` : 'LOST';
        row.classList.toggle('dead', ship.hp <= 0);
      }
      for (const [id, { button, note }] of Object.entries(live.orders)) {
        button.classList.toggle('poor', !canOrder(state, id));
        button.classList.toggle('active', b.order === id);
        note.textContent = b.order === id ? 'Ordered' : b.cooldown[id] ? `Ready in ${b.cooldown[id]} rounds` : 'Ready';
      }
    }
  }

  /** Show how a battle ended ({ type: 'won' | 'lost' | 'retreated', changes, loot }). */
  function showResult(r) {
    result = r;
    if (last) update(last);
  }

  return { panel, update, showResult };
}
