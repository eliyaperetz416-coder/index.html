// Entry point: builds the world, then runs the game loop.
//
//   sim/    the rules (resources, fleet, expeditions, war, term, suit) — no 3D, fully tested
//   world/  terrain, sky, materials        base/   modules, floor plan, ships
//   player/ the astronaut and the camera   ui/     everything drawn over the 3D view
//   engine/ renderer, input, sound, tools

import './ui/style.css';
import * as THREE from 'three';
import { createRenderer } from './engine/renderer.js';
import { createInput } from './engine/input.js';
import { createAudio } from './engine/audio.js';
import { createTerrain, heightAt } from './world/terrain.js';
import { createSky } from './world/sky.js';
import { createBaseView } from './base/baseView.js';
import { createFleetView } from './base/fleetView.js';
import { createLandingField } from './base/ships.js';
import { locate, collide, sightLimit, CELL, FLOOR, WALL_H, DOOR_H } from './base/layout.js';
import { createPlayer, PLAYER_RADIUS } from './player/controller.js';
import { createHud } from './ui/hud.js';
import { lootText } from './ui/mapPanel.js';
import { MODULES, BUILDABLE, GRID_RADIUS } from './data/modules.js';
import { SHIPS } from './data/ships.js';
import { PLANETS } from './data/planets.js';
import { RACES } from './data/races.js';
import { createState, canPlace, placeModule } from './sim/state.js';
import { step } from './sim/game.js';
import { tickSuit, SUIT } from './sim/suit.js';
import { canQueueShip, queueShip, canUpgradeShip, upgradeShip } from './sim/fleet.js';
import { canLaunch, launchExpedition, recallExpedition } from './sim/expedition.js';
import { canChoose, resolveEvent } from './sim/events.js';
import { canJoinBattle, joinBattle, giveOrder, retreat } from './sim/war.js';
import { load, save, clearSave, loadScores, addScore } from './sim/save.js';
import { totalScore, titleFor } from './sim/score.js';

const ROOM_NAMES = { core: 'Command module', habitat: 'Habitat', hydro: 'Greenhouse', oxygen: 'Oxygen plant', storage: 'Storage bay' };
const SPAWN = { x: 3, z: 44, yaw: Math.PI }; // beside the lander, looking at the base
const options = new URLSearchParams(location.search); // ?manual: frames are stepped by window.game.tick() (for automated checks)

const canvas = document.getElementById('scene');
const hudRoot = document.getElementById('hud');
const view = createRenderer(canvas);
const terrain = createTerrain(view.scene);
const sky = createSky(view.scene, view.renderer);
createLandingField(view.scene);
const base = createBaseView(view.scene);
const fleet = createFleetView(view.scene);
const audio = createAudio();
const input = createInput(canvas, hudRoot);

const newSeed = () => Math.floor(Math.random() * 2 ** 31);
let state = load(newSeed());
let buildType = null; // the module being placed, or null
let buildOpen = false;
let indoors = false, placeName = 'Surface';
let blackout = 0; // seconds left of the fade after running out of air

// ---------------------------------------------------------------- the solid world

let solids = { segments: [], circles: [] };
function refreshSolids() {
  solids = { segments: base.colliders.segments, circles: [...base.colliders.circles, ...terrain.colliders, ...fleet.colliders()] };
}

const probe = new THREE.Vector3();
const world = {
  groundAt: (x, z) => locate(base.plan, x, z)?.floor ?? heightAt(x, z),
  collide: (pos, radius) => collide(solids, pos, radius),
  cameraLimit(from, to) {
    let limit = sightLimit(base.colliders, from, to);
    if (locate(base.plan, from.x, from.z)?.indoors) {
      // Indoors the camera stays close, under the ceiling, and never drifts out through a doorway.
      limit = Math.min(limit, 3.2 / from.distanceTo(to));
      for (let i = 1; i <= 12; i++) {
        probe.lerpVectors(from, to, i / 12);
        const spot = locate(base.plan, probe.x, probe.z);
        const ceiling = FLOOR + (spot?.room ? WALL_H : DOOR_H + 0.25) - 0.3;
        if (!spot?.indoors || probe.y > ceiling) { limit = Math.min(limit, (i - 1) / 12); break; }
      }
    }
    for (let i = 1; i <= 6; i++) {
      probe.lerpVectors(from, to, i / 6);
      if (probe.y < world.groundAt(probe.x, probe.z) + 0.3) { limit = Math.min(limit, (i - 1) / 6 + 0.04); break; }
    }
    return Math.max(0.04, limit);
  },
};

const player = createPlayer(view.scene, view.camera, world);

// ---------------------------------------------------------------- consoles and menus

const hud = createHud(hudRoot, {
  touch: input.touch,
  press: input.press,
  callbacks: {
    onBegin: () => audio.start(),
    onRestart: () => startTerm(state.term),
    onNewTerm: () => startTerm(state.term + 1),
    onBuildPick: (type) => pickBuild(buildType === type ? null : type),
    onBuildShip(type) {
      if (refuse(canQueueShip(state, type))) return;
      queueShip(state, type);
      changed();
    },
    onUpgradeShip(id) {
      if (refuse(canUpgradeShip(state, id))) return;
      upgradeShip(state, id);
      changed();
    },
    onLaunch(planetId, shipIds) {
      if (refuse(canLaunch(state, planetId, shipIds))) return;
      launchExpedition(state, planetId, shipIds);
      hud.flash(`Expedition launched to ${PLANETS[planetId].name}. Watch them lift off from the landing field.`);
      changed();
    },
    onRecall() {
      if (recallExpedition(state)) hud.flash('Fleet recalled — heading home.');
      changed();
    },
    onChoose(index) {
      if (refuse(canChoose(state, index))) return null;
      const result = resolveEvent(state, index);
      changed();
      return result;
    },
    onJoin(side, shipIds) {
      if (refuse(canJoinBattle(state, side, shipIds))) return;
      joinBattle(state, side, shipIds);
      changed();
    },
    onOrder(order) {
      giveOrder(state, order);
      changed();
    },
    onRetreat() {
      const result = retreat(state);
      if (result) hud.showWarResult(result);
      changed();
    },
  },
});

/** If a rule says no, tell the player why. Returns true when refused. */
function refuse(check) {
  if (check.ok) return false;
  hud.flash(check.reason);
  audio.deny();
  return true;
}

/** Call after the player changes something: redraw, save. */
function changed() {
  if (base.sync(state)) refreshBuildCells();
  fleet.sync(state);
  refreshSolids();
  hud.update(state, { indoors, name: placeName });
  save(state);
  audio.confirm();
}

function startTerm(number) {
  clearSave();
  state = createState(newSeed(), number);
  pickBuild(null);
  setBuildOpen(false);
  hud.closePanel();
  base.sync(state);
  fleet.sync(state);
  refreshSolids();
  player.place(SPAWN.x, SPAWN.z, SPAWN.yaw);
  hud.update(state, { indoors, name: placeName });
  save(state);
}

/** Record the final score (once) and show the end-of-term screen. */
function endTerm() {
  pickBuild(null);
  setBuildOpen(false);
  hud.closePanel();
  if (!state.scored) {
    const score = totalScore(state);
    addScore({ runId: state.runId, term: state.term, score, title: titleFor(score), date: Date.now() });
    state.scored = true;
    save(state);
  }
  hud.showScore(state, loadScores());
}

// ---------------------------------------------------------------- building

function setBuildOpen(open) {
  buildOpen = open;
  if (!open) pickBuild(null);
  hud.setBuild(open, buildType);
}

function pickBuild(type) {
  buildType = type;
  hud.setBuild(buildOpen, type);
  refreshBuildCells();
  if (!type) base.aimGhost(null);
}

function refreshBuildCells() {
  if (!buildType) return base.showBuildCells(null);
  const cells = [];
  for (let x = -GRID_RADIUS; x <= GRID_RADIUS; x++) {
    for (let z = -GRID_RADIUS; z <= GRID_RADIUS; z++) {
      const check = canPlace(state, buildType, x, z);
      if (check.ok || check.reason === 'Not enough resources') cells.push({ x, z });
    }
  }
  base.showBuildCells(cells);
}

/** The build site the commander is looking at: the cell about 9 m ahead of the camera. */
function aimedCell() {
  const reach = 9;
  return {
    x: Math.round((player.pos.x - Math.sin(player.camYaw) * reach) / CELL),
    z: Math.round((player.pos.z - Math.cos(player.camYaw) * reach) / CELL),
  };
}

function checkSite(cell) {
  const check = canPlace(state, buildType, cell.x, cell.z);
  if (!check.ok) return check;
  const dx = Math.abs(player.pos.x - cell.x * CELL), dz = Math.abs(player.pos.z - cell.z * CELL);
  if (dx < CELL / 2 + PLAYER_RADIUS && dz < CELL / 2 + PLAYER_RADIUS) return { ok: false, reason: 'Step back from the build site' };
  return { ok: true };
}

function placeAimed() {
  const cell = aimedCell();
  if (refuse(checkSite(cell))) return;
  const type = buildType;
  placeModule(state, type, cell.x, cell.z);
  audio.build();
  hud.flash(`${MODULES[type].name} built.`);
  changed();
}

// ---------------------------------------------------------------- one frame

const STEP = 0.25; // seconds of game time per rules step
let last = performance.now(), pending = 0, sinceSave = 0, time = 0;
let doorWasOpen = false, wasOnGround = true;

function useTarget() {
  let best = null, bestD = 2.5;
  for (const t of base.terminals) {
    const d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z);
    if (d < bestD) { best = t; bestD = d; }
  }
  return best;
}

function rules() {
  const { launched, expedition, war, termOver } = step(state, STEP);
  if (state.over && !termOver) return;
  let fleetChanged = !!launched;
  if (war) {
    if (war.type === 'offer') hud.flash('A battle is starting at the front. Join from the war room in the Command module.');
    if (war.type === 'won' || war.type === 'lost') { hud.showWarResult(war); save(state); }
    if (war.type !== 'offer' && war.type !== 'ignored') fleetChanged = true;
    if (war.ended) hud.flash(`The war is over — the ${RACES[war.ended].name} have won.`);
  }
  if (launched) hud.flash(`${SHIPS[launched.type].name} finished — it is on the landing field.`);
  if (expedition) {
    const name = PLANETS[expedition.planet].name;
    if (expedition.type === 'arrived') hud.flash(`The fleet has reached ${name}.`);
    if (expedition.type === 'leaving') hud.flash(`The fleet is leaving ${name}.`);
    if (expedition.type === 'returned') {
      fleetChanged = true;
      hud.flash(`Expedition home. Unloaded: ${lootText(expedition.loot) || 'nothing'}.`);
      save(state);
    }
  }
  if (tickSuit(state, STEP, indoors) === 'blackout') {
    blackout = 2.4;
    const core = base.plan.rooms.find((r) => r.enterable) ?? { x: 0, z: 0 };
    player.place(core.x, core.z + 2.5, Math.PI);
    hud.flash(`You blacked out. The crew dragged you inside. −${SUIT.fine} credits.`);
  }
  if (fleetChanged) { fleet.sync(state); refreshSolids(); }
  if (termOver) endTerm();
  hud.update(state, { indoors, name: placeName });
}

function frame(dt, draw = true) {
  time += dt;

  const blocking = hud.isBlocking();
  input.setEnabled(!blocking);
  const inp = input.frame();

  // --- keys that work everywhere ---
  if (inp.pressed.has('mute')) hud.flash(audio.toggleMute() ? 'Sound off' : 'Sound on');
  if (inp.pressed.has('back')) {
    if (hud.isPanelOpen()) hud.closePanel();
    else if (buildType) pickBuild(null);
    else setBuildOpen(false);
  }
  if (inp.pressed.has('build')) { setBuildOpen(!buildOpen); audio.click(); }

  const moved = player.update(dt, time, inp);
  if (moved.landedStep) audio.step(indoors);
  if (moved.onGround && !wasOnGround) audio.land();
  wasOnGround = moved.onGround;

  const here = locate(base.plan, player.pos.x, player.pos.z);
  indoors = !!here?.indoors;
  placeName = indoors ? `${here.room ? ROOM_NAMES[here.room.type] : 'Corridor'} · pressurised` : 'Surface · no air';

  // --- the rules tick at a steady pace, whatever the frame rate ---
  if (!state.over) pending += dt;
  while (pending >= STEP) { pending -= STEP; rules(); }
  sinceSave += dt;
  if (sinceSave > 10) { sinceSave = 0; save(state); }

  // --- what "use" does right now ---
  if (!blocking) {
    if (buildType) {
      const cell = aimedCell();
      const check = checkSite(cell);
      base.aimGhost(cell, check.ok);
      hud.setPrompt(check.ok ? `Place ${MODULES[buildType].name}` : check.reason, !check.ok);
      if (inp.pressed.has('use') || inp.pressed.has('tap')) placeAimed();
    } else {
      const target = useTarget();
      hud.setPrompt(target ? target.label : null);
      if (target && inp.pressed.has('use')) { hud.openPanel(target.action); audio.click(); }
    }
    if (buildOpen) BUILDABLE.forEach((type, i) => inp.pressed.has(`digit${i + 1}`) && pickBuild(type));
  } else {
    hud.setPrompt(null);
  }

  base.update(dt, time, player.pos);
  if (base.doorOpen() !== doorWasOpen) { doorWasOpen = !doorWasOpen; audio.door(); }
  fleet.update(dt);
  sky.update(view.camera, player.pos, dt, time);
  audio.update(dt, time, indoors);

  blackout = Math.max(0, blackout - dt);
  view.setFade(Math.min(1, blackout / 1.2));
  view.setDanger(indoors ? 0 : Math.max(0, Math.min(1, (25 - state.suit.oxygen) / 25)));
  if (draw) view.render(dt, time);
}

function loop(now) {
  frame(Math.min(0.05, (now - last) / 1000));
  last = now;
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- start

base.sync(state);
fleet.sync(state);
refreshSolids();
player.place(SPAWN.x, SPAWN.z, SPAWN.yaw);
hud.update(state, { indoors, name: placeName });
if (state.over) endTerm();
window.addEventListener('pagehide', () => save(state));

// Handy while developing and for the automated checks: window.game.player.place(x, z, yaw) etc.
window.game = {
  player, hud, base, pickBuild, setBuildOpen, startTerm, refresh: changed,
  get state() { return state; },
  /** Run n frames of dt seconds each, right now. */
  /** Only the last frame is drawn. */
  tick(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) frame(dt, i === n - 1); },
};

if (!options.has('manual')) requestAnimationFrame(loop);
