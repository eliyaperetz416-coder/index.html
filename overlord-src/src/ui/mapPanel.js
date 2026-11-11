// The Star Map panel: pick a planet and ships, launch, then follow the expedition.

import { PLANETS } from '../data/planets.js';
import { SHIPS } from '../data/ships.js';
import { RARE } from '../data/resources.js';
import { canLaunch, expeditionCost, lootTotal } from '../sim/expedition.js';
import { fleetRank } from '../sim/fleet.js';
import { standing } from '../sim/events.js';
import { RACES } from '../data/races.js';
import { el, costText } from './dom.js';

const rareName = (id) => RARE.find((r) => r.id === id).name;
const PHASES = { outbound: 'Flying out', onsite: 'Gathering resources', return: 'Flying home' };
const signed = (n) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));

/** How long the current phase lasts in total, for the progress bar. */
function phaseLength(expedition) {
  const planet = PLANETS[expedition.planet];
  return expedition.phase === 'onsite' ? planet.stay : planet.travel;
}

/**
 * @param onLaunch called with (planetId, shipIds)
 * @param onRecall called when the player calls the fleet home
 */
export function createMapPanel({ onLaunch, onRecall }) {
  const panel = el('div', 'panel map');
  panel.hidden = true;
  const title = el('h3', null, 'Star Map');
  const body = el('div', 'panel-body');
  panel.append(title, body);

  let planetId = null; // the player's current picks
  const picked = new Set();
  let last = null; // the latest state, so clicks can redraw
  let drawn = '';
  let live = {}; // elements that update every tick while an expedition is out

  panel.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button || !last) return;
    const d = button.dataset;
    if (d.planet) planetId = d.planet;
    if (d.ship) picked.has(Number(d.ship)) ? picked.delete(Number(d.ship)) : picked.add(Number(d.ship));
    if (d.launch) onLaunch(planetId, [...picked]);
    if (d.recall) onRecall();
    update(last);
  });

  function renderPlanning(state) {
    const nodes = [];
    const rank = fleetRank(state);

    const row = el('div', 'planets');
    for (const [id, p] of Object.entries(PLANETS)) {
      const card = el('button', 'planet');
      card.dataset.planet = id;
      card.style.setProperty('--c', p.color);
      card.classList.toggle('active', id === planetId);
      card.classList.toggle('locked', rank < p.minRank);
      card.append(
        el('i'),
        el('strong', null, p.name),
        el('span', `rep ${standing(state.reputation[p.race]).toLowerCase()}`, `${RACES[p.race].name} · ${standing(state.reputation[p.race])}`),
        el('span', null, `${p.travel}s away`),
        el('span', 'need', `Needs level ${p.minRank} ship`),
        el('em', null, p.rare.map(rareName).join(' + ')),
      );
      row.append(card);
    }
    nodes.push(row);

    if (state.ships.length === 0) {
      nodes.push(el('p', 'muted', 'You have no ships. Build a Shipyard, then build ships in the Fleet panel.'));
    } else {
      nodes.push(el('p', 'muted', 'Ships to send:'));
      const ships = el('div', 'ship-picks');
      for (const ship of state.ships) {
        const chip = el('button', 'pick', `${SHIPS[ship.type].name} L${ship.level}`);
        chip.dataset.ship = ship.id;
        chip.style.setProperty('--c', SHIPS[ship.type].color);
        chip.classList.toggle('active', picked.has(ship.id));
        ships.append(chip);
      }
      nodes.push(ships);
    }

    const check = canLaunch(state, planetId, [...picked]);
    const launch = el('button', 'btn launch');
    launch.dataset.launch = '1';
    launch.classList.toggle('poor', !check.ok);
    const supplies = planetId && picked.size ? `Supplies: ${costText(expeditionCost(planetId, picked.size))}` : '';
    launch.append(el('strong', null, check.ok ? `Launch to ${PLANETS[planetId].name}` : check.reason), el('em', null, supplies));
    nodes.push(launch);
    return nodes;
  }

  function renderActive(state) {
    const e = state.expedition;
    const planet = PLANETS[e.planet];
    const box = el('div', 'active-trip');
    box.style.setProperty('--c', planet.color);
    live = { phase: el('strong'), bar: el('div'), cargo: el('span') };
    const bar = el('div', 'progress');
    bar.append(live.bar);
    box.append(el('i'), el('h4', null, `Expedition to ${planet.name}`), live.phase, bar, live.cargo);
    const nodes = [box];
    if (e.phase !== 'return') {
      const recall = el('button', 'btn');
      recall.dataset.recall = '1';
      recall.append(el('strong', null, 'Recall fleet'), el('em', null, 'Come home now with what is on board.'));
      nodes.push(recall);
    }
    return nodes;
  }

  /** Where you stand with each race. */
  function renderRaces(state) {
    const box = el('div', 'races');
    for (const [id, race] of Object.entries(RACES)) {
      const rep = state.reputation[id];
      const line = el('div', 'race');
      line.style.setProperty('--c', race.color);
      const enemy = race.enemy ? ` At war with the ${RACES[race.enemy].name}.` : '';
      line.append(el('strong', null, race.name), el('b', `rep ${standing(rep).toLowerCase()}`, `${standing(rep)} ${signed(rep)}`), el('span', null, race.desc + enemy));
      box.append(line);
    }
    return box;
  }

  function renderHold(state) {
    const owned = RARE.filter((r) => state.rare[r.id] > 0);
    const hold = el('div', 'hold');
    hold.append(el('span', 'muted', 'Rare resources: '));
    if (owned.length === 0) hold.append(el('span', 'muted', 'none yet — bring some home from an expedition.'));
    for (const r of owned) hold.append(el('b', null, `${r.name} ${state.rare[r.id]}`));
    return hold;
  }

  function update(state) {
    last = state;
    for (const id of [...picked]) if (!state.ships.some((s) => s.id === id)) picked.delete(id);
    const e = state.expedition;

    const signature = JSON.stringify([
      e ? [e.planet, e.phase] : [planetId, [...picked], canLaunch(state, planetId, [...picked])],
      state.ships,
      state.rare,
      state.reputation,
    ]);
    if (signature !== drawn) {
      drawn = signature;
      body.replaceChildren(...(e ? renderActive(state) : renderPlanning(state)), renderRaces(state), renderHold(state));
    }
    if (e) {
      live.phase.textContent = e.event ? 'Waiting for your orders' : `${PHASES[e.phase]} · ${Math.ceil(Math.max(0, e.remaining))}s`;
      live.bar.style.width = `${100 * (1 - Math.max(0, e.remaining) / phaseLength(e))}%`;
      live.cargo.textContent = `Cargo ${Math.floor(lootTotal(e))}/${e.cargo}`;
    }
  }

  return { panel, update };
}

/** One-line summary of an expedition for the top of the screen. */
export function expeditionLine(expedition) {
  if (expedition.event) return `Orders needed · ${PLANETS[expedition.planet].name}`;
  return `${PHASES[expedition.phase]} · ${PLANETS[expedition.planet].name} · ${Math.ceil(Math.max(0, expedition.remaining))}s`;
}

/** { lightMetal: 15 } → "15 Light Metal" */
export const lootText = (loot) =>
  Object.entries(loot)
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => `${amount} ${rareName(id)}`)
    .join(' + ');
