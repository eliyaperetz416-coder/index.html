import * as THREE from 'three';
import { createRenderer } from './engine/renderer.js';
import { Stage } from './engine/stage.js';
import { CutscenePlayer } from './engine/cutscene.js';
import { WalkController } from './engine/walk.js';
import { initInput, setInputEnabled } from './engine/input.js';
import { unlockAudio, setAmbience, playSound } from './engine/audio.js';
import { ui } from './ui.js';

const chapters = import.meta.glob('../data/chapters/*.json', { eager: true, import: 'default' });
const chapter = chapters['../data/chapters/ch1.json'];

const { renderer, camera, fitToScreen } = createRenderer(document.getElementById('app'));
const timer = new THREE.Timer();
const game = { stage: null, cutscenes: null, walker: null, timeScale: 1 };

function frame(time) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1) * game.timeScale;
  game.stage?.update(dt);
  game.cutscenes?.update(dt);
  game.walker?.update(dt);
  fitToScreen();
  if (game.stage) renderer.render(game.stage.scene, camera);
}
renderer.setAnimationLoop(frame);

async function useScene(name) {
  const data = chapter.scenes[name];
  if (game.stage?.data === data) return game.stage;
  const stage = new Stage(data);
  await stage.load();
  game.stage = stage;
  game.cutscenes = new CutscenePlayer({ stage, camera, ui });
  game.walker = new WalkController({ stage, camera, areas: data.areas ?? [] });
  setAmbience(data.ambience);
  return stage;
}

// Each flow step type is one handler; new chapters reuse these with new data.
const steps = {
  async title() {
    await ui.titleCard(chapter.title, chapter.subtitle);
  },

  async cutscene(step) {
    const cutscene = chapter.cutscenes[step.id];
    await useScene(cutscene.scene);
    const done = game.cutscenes.play(cutscene);
    ui.fadeFromBlack();
    await done;
  },

  /** Runs a stage action, e.g. { "action": "move", "node": "Door", "by": [1, 0, 0] }. */
  async do(step) {
    if (step.sound) playSound(step.sound, step);
    game.stage[step.action](step);
    if (step.wait) await new Promise((r) => setTimeout(r, step.wait * 1000));
  },

  /** Hands control to the player until they reach the goal. */
  async walk(step) {
    const stage = await useScene(step.scene);
    await ui.fadeToBlack();
    stage.place({ target: step.character, at: step.spawn });
    stage.setPose({ target: step.character, pose: 'stand', duration: 0 });
    game.walker.start(step.character);
    ui.fadeFromBlack();
    ui.objective(step.objective);
    setInputEnabled(true);
    await new Promise((resolve) => {
      const check = () => {
        if (game.walker.distanceTo(step.goal.target) <= step.goal.radius) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
    setInputEnabled(false);
    game.walker.stop();
  },

  async objective(step) {
    ui.objective(step.text);
  },
};

async function run() {
  initInput();
  ui.setLoading('טוען...');
  const first = chapter.flow.find((s) => s.type === 'cutscene');
  await useScene(chapter.cutscenes[first.id].scene);
  ui.setLoading('הקש כדי להתחיל');
  await ui.waitForStart();
  unlockAudio();
  setAmbience(game.stage.data.ambience);
  for (const step of chapter.flow) await steps[step.type](step);
}

if (import.meta.env.DEV) window.__dn = game;

run().catch((err) => {
  console.error(err);
  ui.setLoading(`שגיאה: ${err.message}`);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
