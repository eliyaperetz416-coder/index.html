import * as THREE from 'three';
import { createRenderer } from './engine/renderer.js';
import { Stage } from './engine/stage.js';
import { CutscenePlayer } from './engine/cutscene.js';
import { WalkController } from './engine/walk.js';
import { initInput, setInputEnabled } from './engine/input.js';
import { unlockAudio, setAmbience, playSound } from './engine/audio.js';
import { ui } from './ui.js';
import { showRules, runNewsPuzzle, showEnd } from './screens.js';
import { setChapterResult } from './state.js';

const chapters = import.meta.glob('../data/chapters/*.json', { eager: true, import: 'default' });
const chapter = chapters['../data/chapters/ch1.json'];

const { renderer, camera, fitToScreen } = createRenderer(document.getElementById('app'));
const timer = new THREE.Timer();
const game = { stage: null, cutscenes: null, walker: null, timeScale: 1, onFrame: null, result: null };

function frame(time) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1) * game.timeScale;
  game.stage?.update(dt);
  game.cutscenes?.update(dt);
  game.walker?.update(dt);
  game.onFrame?.();
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

  /** Shows a tap button over a 3D object; the player can keep walking until they tap it. */
  async tap(step) {
    ui.objective(step.objective);
    game.walker.resume();
    setInputEnabled(true);
    const marker = document.getElementById('tap-marker');
    marker.textContent = step.label;
    const target = game.stage.node(step.target);
    const p = new THREE.Vector3();
    game.onFrame = () => {
      target.getWorldPosition(p);
      p.y += 0.35;
      p.project(camera);
      const near = game.walker.distanceTo(step.target) <= step.range;
      marker.hidden = !near || p.z > 1;
      marker.style.transform = `translate(${(p.x * 0.5 + 0.5) * innerWidth}px, ${(-p.y * 0.5 + 0.5) * innerHeight}px)`;
    };
    await new Promise((resolve) => marker.addEventListener('click', resolve, { once: true }));
    game.onFrame = null;
    marker.hidden = true;
    setInputEnabled(false);
    game.walker.stop();
    ui.objective(null);
  },

  async rules() {
    await showRules();
  },

  /** Inner monologue / dialogue lines shown one after another as captions. */
  async say(step) {
    for (const line of step.lines) await ui.say(line);
  },

  /** Time/place card over black, e.g. "That evening". */
  async card(step) {
    await ui.fadeToBlack();
    await ui.titleCard(step.title, step.text);
  },

  async puzzle(step) {
    game.result = await runNewsPuzzle(chapter.puzzles[step.id], { say: ui.say });
  },

  async end(step) {
    const result = game.result ?? {};
    const meter = setChapterResult(chapter.id, { suspicion: result.suspicion ?? 0, choice: result.id });
    await showEnd({ title: step.text, summary: result.summary, ...meter });
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

// Double tap anywhere skips the running cutscene.
let lastTap = 0;
window.addEventListener('pointerdown', () => {
  const now = performance.now();
  if (game.cutscenes?.active && now - lastTap < 400) {
    game.cutscenes.skip();
    lastTap = 0;
  } else {
    lastTap = now;
  }
});

if (import.meta.env.DEV) window.__dn = game;

run().catch((err) => {
  console.error(err);
  ui.setLoading(`שגיאה: ${err.message}`);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}
