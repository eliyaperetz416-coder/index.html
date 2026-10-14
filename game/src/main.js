import * as THREE from 'three';
import { createRenderer } from './engine/renderer.js';
import { Stage } from './engine/stage.js';
import { CutscenePlayer } from './engine/cutscene.js';
import { unlockAudio, setAmbience } from './engine/audio.js';
import { ui } from './ui.js';

const chapters = import.meta.glob('../data/chapters/*.json', { eager: true, import: 'default' });
const chapter = chapters['../data/chapters/ch1.json'];

const { renderer, camera } = createRenderer(document.getElementById('app'));
const timer = new THREE.Timer();
const game = { stage: null, player: null, timeScale: 1 };

function frame(time) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1) * game.timeScale;
  game.stage?.update(dt);
  game.player?.update(dt);
  if (game.stage) renderer.render(game.stage.scene, camera);
}
renderer.setAnimationLoop(frame);

async function loadScene(name) {
  const stage = new Stage(chapter.scenes[name]);
  await stage.load();
  game.stage = stage;
  game.player = new CutscenePlayer({ stage, camera, ui });
  return stage;
}

// Each flow step type is one handler; new chapters reuse these with new data.
const steps = {
  async title() {
    await ui.titleCard(chapter.title, chapter.subtitle);
  },
  async cutscene(step) {
    const cutscene = chapter.cutscenes[step.id];
    if (game.stage?.data !== chapter.scenes[cutscene.scene]) await loadScene(cutscene.scene);
    setAmbience(chapter.scenes[cutscene.scene].ambience);
    const done = game.player.play(cutscene);
    ui.fadeFromBlack();
    await done;
  },
  async objective(step) {
    ui.objective(step.text);
  },
};

async function run() {
  ui.setLoading('טוען...');
  const first = chapter.flow.find((s) => s.type === 'cutscene');
  const preload = loadScene(chapter.cutscenes[first.id].scene);
  await preload;
  ui.setLoading('הקש כדי להתחיל');
  await ui.waitForStart();
  unlockAudio();
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
