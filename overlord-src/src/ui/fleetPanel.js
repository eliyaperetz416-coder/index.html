// The Fleet panel: build ships, watch the queue, upgrade ships.

import { SHIPS, MAX_LEVEL } from '../data/ships.js';
import { canPay } from '../sim/state.js';
import { shipyardCount, fleetCap, fleetRank, shipStats, upgradeCost, canQueueShip, canUpgradeShip } from '../sim/fleet.js';
import { isAway } from '../sim/expedition.js';
import { el, costText } from './dom.js';

/**
 * @param onBuild   called with a ship type
 * @param onUpgrade called with a ship id
 */
export function createFleetPanel({ onBuild, onUpgrade }) {
  const panel = el('div', 'panel fleet');
  panel.hidden = true;
  const title = el('h3');
  const body = el('div', 'panel-body');
  const queueLabel = el('div', 'queue-label');
  const bar = el('div', 'progress');
  const fill = el('div');
  bar.append(fill);
  const queueBox = el('div', 'queue');
  queueBox.append(queueLabel, bar);
  panel.append(title, queueBox, body);

  // One listener for every button in the panel (buttons carry data-build / data-upgrade).
  panel.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.dataset.build) onBuild(button.dataset.build);
    if (button.dataset.upgrade) onUpgrade(Number(button.dataset.upgrade));
  });

  let drawn = ''; // what the list looked like last time, so we only rebuild it when something changed

  function renderBody(state) {
    const nodes = [];
    if (shipyardCount(state) === 0) nodes.push(el('p', 'muted', 'Build a Shipyard module to construct ships.'));

    const buildRow = el('div', 'build-row');
    for (const [type, def] of Object.entries(SHIPS)) {
      const button = el('button', 'btn');
      button.style.setProperty('--c', def.color);
      button.dataset.build = type;
      button.classList.toggle('poor', !canQueueShip(state, type).ok);
      button.append(el('strong', null, `+ ${def.name}`), el('span', null, def.desc), el('em', null, costText(def.cost)));
      buildRow.append(button);
    }
    nodes.push(buildRow);

    for (const ship of state.ships) {
      const def = SHIPS[ship.type];
      const stats = shipStats(ship);
      const row = el('div', 'ship');
      row.style.setProperty('--c', def.color);
      const info = el('div');
      info.append(
        el('strong', null, `${def.name} · L${ship.level}`),
        el('span', null, `Cargo ${stats.cargo} · Attack ${stats.attack} · Hull ${stats.hull}`),
      );
      row.append(info);
      if (isAway(state, ship.id)) row.append(el('span', 'away', 'AWAY'));
      else if (ship.level >= MAX_LEVEL) row.append(el('span', 'max', 'MAX'));
      else {
        const up = el('button', 'btn small');
        up.dataset.upgrade = ship.id;
        up.classList.toggle('poor', !canUpgradeShip(state, ship.id).ok);
        up.append(el('strong', null, 'Upgrade'), el('em', null, costText(upgradeCost(ship))));
        row.append(up);
      }
      nodes.push(row);
    }
    body.replaceChildren(...nodes);
  }

  function update(state) {
    title.textContent = `Fleet ${state.ships.length}/${fleetCap(state)} · Rank ${fleetRank(state)}`;

    const job = state.queue[0];
    queueBox.hidden = !job;
    if (job) {
      const waiting = state.queue.length - 1;
      queueLabel.textContent = `Building ${SHIPS[job.type].name}${waiting ? ` (+${waiting} waiting)` : ''}`;
      fill.style.width = `${100 * (1 - Math.max(0, job.remaining) / SHIPS[job.type].buildTime)}%`;
    }

    const signature = JSON.stringify([
      state.ships,
      state.queue.length,
      state.expedition?.shipIds,
      shipyardCount(state),
      Object.keys(SHIPS).map((t) => canQueueShip(state, t).ok),
      state.ships.map((s) => canPay(state, upgradeCost(s))),
    ]);
    if (signature !== drawn) {
      drawn = signature;
      renderBody(state);
    }
  }

  return { panel, update };
}
