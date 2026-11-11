// Entry point: wires the rules (sim), the 3D view (render) and the interface (ui) together.

import './ui/style.css';
import { createScene } from './render/scene.js';
import { createBaseView } from './render/baseView.js';
import { createHud } from './ui/hud.js';
import { createState, tick, canPlace, placeModule } from './sim/state.js';
import { load, save, clearSave } from './sim/save.js';

const canvas = document.getElementById('scene');
const world = createScene(canvas);
const base = createBaseView(world);

let state = load();

const hud = createHud(document.getElementById('hud'), {
  onSelect(type) {
    base.setGhost(type);
    base.showSlots(state, type);
  },
  onReset() {
    clearSave();
    state = createState();
    hud.select(null);
    base.sync(state);
  },
});
base.sync(state);
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
    tick(state, STEP);
    hud.update(state);
  }
  sinceSave += dt;
  if (sinceSave > 10) {
    sinceSave = 0;
    save(state);
  }
  base.update(now / 1000, dt);
  world.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('pagehide', () => save(state));
