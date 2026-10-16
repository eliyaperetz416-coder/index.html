// Game loop + state machine. Owns renderer, camera, world, player and traffic.
import * as THREE from 'three';
import { CFG } from './config.js';
import { WORLDS, DEFAULT_WORLD } from './data/worlds.js';
import { CARS, carById } from './data/cars.js';
import { World } from './world.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { save } from './storage.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const q = save.data.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q === 'high', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
    this.ui = new UI();
    this.input = new Input();
    this.state = 'title';
    this.clock = { last: 0 };
    this.run = null;

    this.worldDef = WORLDS[save.data.settings.world] || WORLDS[DEFAULT_WORLD];
    this.world = new World(this.scene, this.worldDef, q);
    this.traffic = new Traffic(this.scene, this.worldDef);
    const car = carById(save.data.selectedCar) || CARS[0];
    this.player = new Player(this.scene, car, this.statsFor(car), this.worldDef);

    this.input.onLane = (d) => { if (this.state === 'playing') this.player.changeLane(d); };
    this.input.onAnyStart = () => { if (this.state === 'title') this.startRun(); else if (this.state === 'gameover') this.startRun(); };
    this.ui.buildButtons((d) => { if (this.state === 'playing') this.player.changeLane(d); });

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
    this._tick = this._tick.bind(this);
    this.camShake = 0;
  }

  statsFor(car) {
    return { topSpeed: car.topSpeed, accel: car.accel, handling: car.handling, comboMult: car.comboMult, nitro: car.nitro };
  }

  // ---- lifecycle ----
  start() {
    this.setState('title');
    requestAnimationFrame(this._tick);
  }

  setState(s) {
    this.state = s;
    if (s === 'title') {
      this.ui.showControls(false); this.ui.showHud(false);
      this.ui.showStart(() => this.startRun());
    }
  }

  startRun() {
    this.traffic.reset();
    this.player.reset();
    this.run = { score: 0, distance: 0, topKmh: 0, time: 0 };
    this.ui.clearScreens(); this.ui.showControls(true); this.ui.showHud(true);
    this.state = 'playing';
  }

  endRun() {
    this.state = 'gameover';
    const r = this.run;
    const id = this.player.car.id;
    const prev = save.data.bestByCar[id] || 0;
    const newBest = r.score > prev;
    if (newBest) save.data.bestByCar[id] = Math.floor(r.score);
    save.data.bestScore = Math.max(save.data.bestScore, Math.floor(r.score));
    save.save();
    this.ui.showControls(false);
    this.ui.showGameOver({ score: r.score, best: save.data.bestByCar[id] || 0, newBest, kmh: r.topKmh }, () => this.startRun());
  }

  // ---- loop ----
  _tick(t) {
    requestAnimationFrame(this._tick);
    const dt = Math.min(0.05, (t - (this.clock.last || t)) / 1000);
    this.clock.last = t;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const playing = this.state === 'playing';
    const speed = this.player.speed;
    if (playing) {
      this.player.update(dt);
      const r = this.run;
      r.time += dt;
      r.distance += this.player.speed * dt;
      r.topKmh = Math.max(r.topKmh, this.player.kmh);
      r.score += this.player.kmh * dt * 0.4;
      const difficulty = Math.min(1, r.time / 180);
      this.traffic.update(dt, this.player.speed, difficulty, this.player.len, this.player.x);
      const hit = this.traffic.collide(this.player.x, this.player.len, this.player.wid);
      if (hit) this.endRun();
      this.ui.setHud({ score: r.score, kmh: this.player.kmh });
    } else if (this.state === 'title') {
      // attract mode: idle cruise
      this.traffic.update(dt, speed, 0.2, this.player.len, this.player.x);
      this.player.update(dt);
    }
    this.world.update(dt, playing || this.state === 'title' ? this.player.speed : this.player.speed * 0.0);
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const p = this.player, cam = this.camera;
    const portrait = this.aspect < 1;
    const dist = portrait ? 13 : 8.6, height = portrait ? 5 : 3.3;
    const tx = p.x * 0.6;
    cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 6);
    cam.position.y = height; cam.position.z = dist;
    cam.lookAt(p.x * 0.45, 1.1, -18);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const q = save.data.settings.quality;
    const cap = q === 'high' ? 2 : q === 'medium' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    const dist = this.aspect < 1 ? 13 : 8.6;
    const halfW = Math.atan(6.6 / dist);
    const vfov = 2 * Math.atan(Math.tan(halfW) / this.aspect) * 180 / Math.PI;
    this.camera.fov = THREE.MathUtils.clamp(vfov, 55, 86);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }
}
