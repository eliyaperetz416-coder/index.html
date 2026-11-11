// Entry point: wires the rules (sim), the 3D view (render) and the interface (ui) together.

import './ui/style.css';
import { createScene } from './render/scene.js';
import { createBaseView } from './render/baseView.js';
import { createHud } from './ui/hud.js';
import { createFleetView } from './render/fleetView.js';
import { createState, canPlace, placeModule } from './sim/state.js';
import { step } from './sim/game.js';
import { SHIPS } from './data/ships.js';
import { canQueueShip, queueShip, canUpgradeShip, upgradeShip } from './sim/fleet.js';
import { canLaunch, launchExpedition, recallExpedition } from './sim/expedition.js';
import { canChoose, resolveEvent } from './sim/events.js';
import { canJoinBattle, joinBattle, giveOrder, retreat } from './sim/war.js';
import { PLANETS } from './data/planets.js';
import { lootText } from './ui/mapPanel.js';
import { load, save, clearSave, loadScores, addScore } from './sim/save.js';
import { totalScore, titleFor } from './sim/score.js';
import { RACES } from './data/races.js';

const canvas = document.getElementById('scene');
const world = createScene(canvas);
const base = createBaseView(world);
const fleet = createFleetView(world);

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

let state = load(newSeed());

const hud = createHud(document.getElementById('hud'), {
  onSelect(type) {
    base.setGhost(type);
    base.showSlots(state, type);
  },
  onReset() {
    startTerm(state.term); // replay this term from scratch
  },
  onNewTerm() {
    startTerm(state.term + 1);
  },
  onBuildShip(type) {
    const check = canQueueShip(state, type);
    if (!check.ok) return hud.flash(check.reason);
    queueShip(state, type);
    changed();
  },
  onUpgradeShip(id) {
    const check = canUpgradeShip(state, id);
    if (!check.ok) return hud.flash(check.reason);
    upgradeShip(state, id);
    fleet.sync(state);
    changed();
  },
  onLaunch(planetId, shipIds) {
    const check = canLaunch(state, planetId, shipIds);
    if (!check.ok) return hud.flash(check.reason);
    launchExpedition(state, planetId, shipIds);
    fleet.sync(state);
    hud.flash(`Expedition launched to ${PLANETS[planetId].name}!`);
    changed();
  },
  onChoose(index) {
    const check = canChoose(state, index);
    if (!check.ok) return hud.flash(check.reason), null;
    const result = resolveEvent(state, index);
    changed();
    return result;
  },
  onJoin(side, shipIds) {
    const check = canJoinBattle(state, side, shipIds);
    if (!check.ok) return hud.flash(check.reason);
    joinBattle(state, side, shipIds);
    fleet.sync(state);
    changed();
  },
  onOrder(order) {
    giveOrder(state, order);
    changed();
  },
  onRetreat() {
    const result = retreat(state);
    if (result) hud.showWarResult(result);
    fleet.sync(state);
    changed();
  },
  onRecall() {
    if (recallExpedition(state)) hud.flash('Fleet recalled — heading home.');
    changed();
  },
});
base.sync(state);
fleet.sync(state);

function startTerm(number) {
  clearSave();
  state = createState(newSeed(), number);
  hud.select(null);
  base.sync(state);
  fleet.sync(state);
  changed();
}

/** Record the final score (once) and show the end-of-term screen. */
function endTerm() {
  hud.select(null);
  if (!state.scored) {
    const score = totalScore(state);
    addScore({ runId: state.runId, term: state.term, score, title: titleFor(score), date: Date.now() });
    state.scored = true;
    save(state);
  }
  hud.showScore(state, loadScores());
}
if (state.over) endTerm();

/** Call after the player changes something: refresh the HUD and save right away. */
function changed() {
  hud.update(state);
  save(state);
}
hud.update(state);

// --- building: hover shows a preview, a click (not a camera drag) places the module ---
let downAt = null;
canvas.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointermove', (e) => {
  const type = hud.getSelected();
  if (!type) return;
  const cell = base.cellAt(e.clientX, e.clientY);
  base.moveGhost(cell, cell && canPlace(state, type, cell.x, cell.z).ok);
});
canvas.addEventListener('pointerup', (e) => {
  const type = hud.getSelected();
  const wasDrag = !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6;
  downAt = null;
  if (!type || wasDrag || e.button !== 0) return;
  const cell = base.cellAt(e.clientX, e.clientY);
  if (!cell) return;
  const check = canPlace(state, type, cell.x, cell.z);
  if (!check.ok) return hud.flash(check.reason);
  placeModule(state, type, cell.x, cell.z);
  base.sync(state);
  base.showSlots(state, type);
  base.moveGhost(null);
  hud.update(state);
  save(state);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hud.select(null);
});

// --- game loop: the rules advance in fixed steps, the picture redraws every frame ---
const STEP = 0.25; // seconds of game time per rules step
let last = performance.now();
let pending = 0;
let sinceSave = 0;

function frame(now) {
  const dt = Math.min(0.5, (now - last) / 1000); // cap so a background tab does not jump ahead
  last = now;
  pending += dt;
  while (pending >= STEP) {
    pending -= STEP;
    const { launched, expedition, war, termOver } = step(state, STEP);
    if (war) {
      if (war.type === 'offer') hud.flash('A battle is starting at the front! Open the War panel to join.');
      if (war.type === 'won' || war.type === 'lost') {
        hud.showWarResult(war);
        save(state);
      }
      if (war.type !== 'offer' && war.type !== 'ignored') fleet.sync(state); // ships may be lost or back home
    }
    if (war?.ended) hud.flash(`The war is over — the ${RACES[war.ended].name} have won!`);
    if (termOver) endTerm();
    if (launched) {
      fleet.sync(state);
      hud.flash(`${SHIPS[launched.type].name} launched!`);
    }
    if (expedition) {
      const name = PLANETS[expedition.planet].name;
      if (expedition.type === 'arrived') hud.flash(`Fleet arrived at ${name}. Gathering resources.`);
      if (expedition.type === 'leaving') hud.flash(`Fleet is leaving ${name}.`);
      if (expedition.type === 'returned') {
        fleet.sync(state);
        hud.flash(`Expedition home! Loot: ${lootText(expedition.loot) || 'nothing'}`);
        save(state);
      }
    }
    hud.update(state);
  }
  sinceSave += dt;
  if (sinceSave > 10) {
    sinceSave = 0;
    save(state);
  }
  base.update(now / 1000, dt);
  fleet.update(now / 1000);
  world.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('pagehide', () => save(state));
