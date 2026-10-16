// Game loop + state machine. Owns renderer, camera, world, player and traffic.
import * as THREE from 'three';
import { CFG, SCORE } from './config.js';
import { WORLDS, DEFAULT_WORLD } from './data/worlds.js';
import { CARS, carById } from './data/cars.js';
import { World } from './world.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { save } from './storage.js';
import { Scoring } from './scoring.js';
import { Effects } from './effects.js';
import { haptic } from './haptics.js';
import { Screens } from './screens.js';
import { Controls } from './controls.js';
import { statsFor, coinsForScore, applyRunToMissions, ensureMissions } from './progression.js';
import { applyRunToEvent, globalCoinMult } from './events.js';
import { AudioSys } from './audio.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const q = save.data.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q === 'high', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
    this.ui = new UI();
    this.screens = new Screens(this);
    ensureMissions();
    this.input = new Input();
    this.state = 'title';
    this.clock = { last: 0 };
    this.run = null;

    this.worldDef = WORLDS[save.data.settings.world] || WORLDS[DEFAULT_WORLD];
    this.world = new World(this.scene, this.worldDef, q);
    this.traffic = new Traffic(this.scene, this.worldDef);
    const car = carById(save.data.selectedCar) || CARS[0];
    this.player = new Player(this.scene, car, this.statsFor(car), this.worldDef);

    this.scoring = new Scoring(this.player.stats.comboMult);
    this.fx = new Effects(this.renderer, this.scene, this.camera, q);
    this.fx.attachPlayer(this.player);
    this.nitroWanted = false; this._wasNitro = false;
    this.audio = new AudioSys(); this.audio.setWorld(this.worldDef);
    this._unlock = () => { this.audio.unlock(); };
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, this._unlock, { passive: true });
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.btn, .g-nav, .seg button, .world-chips button, .pause-btn')) this.audio.sfx('click'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (this.state === 'playing') this.pause(); this.audio.suspend(); } else this.audio.resume(); });
    this.frames = { n: 0, t: 0, fast: 0 }; this.resScale = 1;
    this._shake = new THREE.Vector3(); this._tmp = new THREE.Vector3();

    this.input.onLane = (d) => { if (this.state === 'playing') this.player.changeLane(d); };
    this.input.onNitro = (v) => { this.nitroWanted = v; };
    this.input.onPause = () => { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resumeRun(); };
    this.input.onAnyStart = () => { if (this.state === 'title') this.startRun(); else if (this.state === 'gameover') this.startRun(this.lastRunOpts); };
    this.controls = new Controls(document.getElementById('controls'), {
      onLane: (d) => { if (this.state === 'playing') this.player.changeLane(d); },
      onNitro: (v) => { this.nitroWanted = v; },
    });
    this.applyControls();
    this.ui.onPause = () => { if (this.state === 'playing') this.pause(); };

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
    this._tick = this._tick.bind(this);
  }

  statsFor(car) { return statsFor(car); }

  // ---- lifecycle ----
  start() {
    this.setState('title');
    requestAnimationFrame(this._tick);
  }

  setState(s) {
    this.state = s;
    if (s === 'title') {
      this.controls.show(false); this.ui.showHud(false);
      if (this.worldDef.id !== save.data.settings.world) this.loadWorld(save.data.settings.world);
      this.traffic.reset();
      this.audio.setMusicMode('menu');
      this.screens.menu();
    }
  }

  // ---- settings application ----
  applyControls() { this.controls.setMode(save.data.settings.control); this.ui.nitroBtn = this.controls.nitroBtn; this.controls.show(this.state === 'playing'); }
  applyQuality() {
    const q = save.data.settings.quality;
    this.resize(); this.fx.setQuality(q);
    this.loadWorld(this.worldDef.id);
  }
  loadWorld(id) {
    const def = WORLDS[id] || WORLDS[DEFAULT_WORLD];
    if (this.world) this.world.dispose();
    if (this.traffic) this.traffic.dispose();
    this.worldDef = def;
    this.world = new World(this.scene, def, save.data.settings.quality);
    this.traffic = new Traffic(this.scene, def);
    this.player.setWorld(def);
    this.audio.setWorld(def);
  }
  resetProgress() {
    save.reset();
    const car = carById(save.data.selectedCar);
    this.player.setCar(car, this.statsFor(car)); this.fx.attachPlayer(this.player);
    ensureMissions(); this.applyControls(); this.applyQuality();
  }

  // ---- garage ----
  enterGarage() {
    this.state = 'garage';
    this.traffic.reset(); this.ui.showHud(false); this.controls.show(false);
    this.garageAngle = 0.6;
    this.screens.garage();
  }
  previewCar(car, stats) {
    if (this.player.car.id !== car.id) { this.player.setCar(car, stats); this.fx.attachPlayer(this.player); }
    else this.player.stats = stats;
  }
  exitGarage() {
    const car = carById(save.data.selectedCar) || CARS[0];
    this.player.setCar(car, this.statsFor(car)); this.fx.attachPlayer(this.player);
    this.camera.clearViewOffset();
    this.setState('title');
  }

  /** opts.event = an event status object from events.js (plays the event's world + counts towards its goal) */
  startRun(opts = {}) {
    this.runEvent = opts.event || null; this.lastRunOpts = opts;
    const wid = this.runEvent?.ev.world || save.data.settings.world;
    if (this.worldDef.id !== wid) this.loadWorld(wid);
    this.traffic.reset();
    this.player.reset();
    this.player.stats = this.statsFor(this.player.car);
    this.scoring = new Scoring(this.player.stats.comboMult);
    this.run = { time: 0, topKmh: 0, distance: 0, crashT: 0 };
    this.nitroWanted = this.input.nitroHeld;
    this.ui.clearScreens(); this.controls.show(true); this.ui.showHud(true);
    this.ui.setCombo(0, 1, 0);
    this.state = 'playing'; this.audio.setMusicMode('play'); this.audio.sfx('go');
    this.ui.popup('GO!', 'tight');
  }

  // ---- pause ----
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.nitroWanted = false;
    this.audio.updateEngine(0, 300, 0, false);
    this.screens.pause({
      resume: () => this.resumeRun(),
      restart: () => this.startRun(this.lastRunOpts),
      menu: () => this.ui.fade(() => { this.ui.showHud(false); this.setState('title'); }),
    });
  }
  resumeRun() {
    if (this.state !== 'paused') return;
    this.ui.clearScreens(); this.state = 'countdown'; this.countdown = 3.0; this._cd = 4;
  }

  endRun() {
    this.state = 'gameover';
    const r = this.run, sc = this.scoring;
    const score = Math.floor(sc.score);
    const id = this.player.car.id;
    const prev = save.data.bestByCar[id] || 0;
    const newBest = score > prev;
    if (newBest) save.data.bestByCar[id] = score;
    save.data.bestScore = Math.max(save.data.bestScore, score);
    const st = save.data.stats;
    st.runs++; st.closeCalls += sc.closeCalls; st.distance += r.distance; st.topSpeed = Math.max(st.topSpeed, r.topKmh);
    const runStats = { closeCalls: sc.closeCalls, tightCalls: sc.tightCalls, maxKmh: r.topKmh, score, bestCombo: sc.bestCombo, distanceKm: r.distance / 1000 };
    const bonus = (this.worldDef.coinBonus || 1) * globalCoinMult() * (this.runEvent && !this.runEvent.ev.modifiers?.global ? this.runEvent.ev.modifiers?.coinMult || 1 : 1);
    const coins = Math.floor(coinsForScore(score) * bonus);
    save.data.coins += coins;
    const missions = applyRunToMissions(runStats);
    const eventRes = this.runEvent ? applyRunToEvent(this.runEvent, runStats) : null;
    save.save();
    this.controls.show(false); this.ui.setCombo(0, 1, 0);
    this.screens.gameOver({
      score, best: save.data.bestByCar[id] || 0, newBest, kmh: r.topKmh, closeCalls: sc.closeCalls, bestCombo: sc.bestCombo,
      coins, bonus, missionsDone: missions.completed, carName: this.player.car.name, event: this.runEvent, eventRes,
    }, { retry: () => this.startRun(this.lastRunOpts), garage: () => this.enterGarage(), menu: () => this.ui.fade(() => this.setState('title')) });
    this.audio.setMusicMode('menu'); if (coins > 0) this.audio.sfx('coin'); if (eventRes && eventRes.completed) this.audio.sfx('win');
  }

  // ---- loop ----
  _tick(t) {
    requestAnimationFrame(this._tick);
    const dt = Math.min(0.05, (t - (this.clock.last || t)) / 1000);
    this.clock.last = t;
    this.update(dt);
    this.fx.render();
    this._adaptResolution(dt);
  }

  // dynamic resolution: if frames get slow, render fewer pixels (and creep back up when there is headroom)
  _adaptResolution(dt) {
    if (this.state === 'paused' || document.hidden) return;
    const f = this.frames; f.n++; f.t += dt;
    if (f.n < 50) return;
    const avg = f.t / f.n; f.n = 0; f.t = 0;
    if (avg > 0.0215 && this.resScale > 0.55) { this.resScale = Math.max(0.55, this.resScale - 0.1); f.fast = 0; this.resize(); }
    else if (avg < 0.0145) { if (++f.fast >= 4 && this.resScale < 1) { this.resScale = Math.min(1, this.resScale + 0.1); f.fast = 0; this.resize(); } }
    else f.fast = 0;
  }

  update(dt) {
    const p = this.player;
    let worldSpeed = p.speed;
    if (this.state === 'playing') {
      p.update(dt, this.nitroWanted);
      const r = this.run, sc = this.scoring;
      r.time += dt; r.distance += p.speed * dt; r.topKmh = Math.max(r.topKmh, p.kmh);
      if (sc.update(dt, p.kmh) === 'expired') { this.ui.popup('COMBO LOST', 'warn'); this.audio.sfx('lost'); }
      const difficulty = Math.min(1, r.time / 180);
      const events = this.traffic.update(dt, p.speed, difficulty, p.len, p.x);
      for (const e of events) if (e.type === 'close') this.onCloseCall(e);
      const hit = this.traffic.collide(p.x, p.len, p.wid);
      if (hit) {
        hit.hit = true;
        if (p.invuln <= 0) this.onHit(hit);
      }
      this.ui.setHud({ score: sc.score, kmh: p.kmh });
      this.ui.setCombo(sc.combo, sc.mult, sc.comboTimer / SCORE.comboWindow);
      this.ui.setNitro(p.nitro.meter, p.nitro.active, p.nitro.locked);
    } else if (this.state === 'countdown') {
      this.countdown -= dt; const n = Math.ceil(this.countdown);
      if (n !== this._cd) { this._cd = n; if (n > 0) { this.ui.popup(String(n), 'tight'); this.audio.sfx('tick'); } }
      if (this.countdown <= 0) { this.state = 'playing'; this.audio.sfx('go'); this.ui.popup('GO!', 'tight'); }
      worldSpeed = 0;
    } else if (this.state === 'paused') {
      worldSpeed = 0;
    } else if (this.state === 'crashing') {
      p.update(dt, false);
      this.run.crashT += dt;
      const f = Math.max(0, 1 - this.run.crashT / SCORE.crashTime);
      this.traffic.update(dt * f, 0, 0, p.len, p.x); // traffic freezes as we stop
      worldSpeed = p.speed;
      if (this.run.crashT >= SCORE.crashTime) this.endRun();
    } else if (this.state === 'title') {
      this.traffic.update(dt, p.speed, 0.2, p.len, p.x);
      p.update(dt, false);
    } else if (this.state === 'garage') {
      worldSpeed = 0; this.garageAngle += dt * 0.5;
      p.model.rotation.y = this.garageAngle; p.root.position.x = 0;
    } else { worldSpeed = 0; }

    const frozen = this.state === 'paused' || this.state === 'countdown';
    if (!frozen) this.world.update(dt, worldSpeed);
    const sf = worldSpeed / CFG.kmhToMs / 300;
    if (!frozen) this.fx.update(dt, sf, p.boostFrac, this.camera, worldSpeed);
    const driving = this.state === 'playing';
    this.audio.updateEngine(p.kmh, p.stats.topSpeed, p.boostFrac, driving);
    if (driving && p.nitro.active !== this._wasNitro) { this._wasNitro = p.nitro.active; if (p.nitro.active) this.audio.sfx('nitro'); }
    this.updateCamera(dt, sf);
  }

  onCloseCall(e) {
    const sc = this.scoring, p = this.player;
    const pts = sc.closeCall(e.tight);
    p.addNitro(e.tight ? 16 : 9);
    this.ui.popup(e.tight ? `TIGHT! +${pts.toLocaleString('en-US')}` : `CLOSE CALL +${pts.toLocaleString('en-US')}`, e.tight ? 'tight' : '');
    haptic(e.tight ? [12, 20, 12] : 10); this.audio.sfx(e.tight ? 'tight' : 'close'); this.audio.sfx('whoosh');
  }

  onHit(car) {
    const p = this.player, ox = this.traffic.lastOverlapX;
    const light = ox < SCORE.lightHitMaxOverlap;
    const dir = Math.sign(p.x - car.x) || (Math.random() < 0.5 ? -1 : 1);
    const cx = (p.x + car.x) / 2 + dir * -0.1;
    if (light) {
      p.hitLight(dir);
      if (this.scoring.breakCombo()) this.ui.popup('COMBO LOST', 'warn');
      this.scoring.lightHits++;
      this.fx.burst(cx, 0.6, 0, 16, 0xffb02e, 5);
      this.fx.shake(0.55); this.ui.flashScreen('white'); haptic(35); this.audio.sfx('light');
    } else {
      this.scoring.breakCombo();
      p.crash();
      this.fx.burst(cx, 0.8, -1, 40, 0xff7a2e, 9);
      this.fx.shake(1); this.ui.flashScreen('red'); haptic([60, 40, 90]); this.audio.sfx('crash');
      this.ui.setCombo(0, 1, 0);
      this.state = 'crashing'; this.run.crashT = 0;
    }
  }

  updateCamera(dt, sf) {
    const p = this.player, cam = this.camera;
    if (this.state === 'garage') {
      const L = p.len, k = this.aspect < 1 ? 1.55 : 1;
      cam.position.lerp(this._tmp.set(L * 0.75 * k, 1.7 * k, (L * 1.5 + 3.2) * k), Math.min(1, dt * 5));
      cam.lookAt(0, 0.65, 0);
      const land = this.aspect >= 1, w = window.innerWidth, hh = window.innerHeight;
      if (land) cam.setViewOffset(w, hh, w * 0.24, 0, w, hh); else cam.setViewOffset(w, hh, 0, hh * 0.22, w, hh);
      const fov = this.baseFov; if (Math.abs(fov - cam.fov) > 0.02) { cam.fov = fov; }
      cam.updateProjectionMatrix();
      return;
    }
    if (cam.view && cam.view.enabled) { cam.clearViewOffset(); cam.updateProjectionMatrix(); }
    const portrait = this.aspect < 1;
    const dist = portrait ? 13 : 8.6, height = portrait ? 5 : 3.3;
    const back = 1.2 * p.boostFrac;
    const tx = p.x * 0.6;
    cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 6);
    cam.position.y = height; cam.position.z = dist + back;
    this.fx.shakeOffset(this._shake);
    cam.position.add(this._shake);
    cam.lookAt(p.x * 0.45, 1.1, -18);
    const fov = this.baseFov + sf * 6 + p.boostFrac * 9;
    if (Math.abs(fov - cam.fov) > 0.02) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const q = save.data.settings.quality;
    const cap = q === 'high' ? 2 : q === 'medium' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap) * (this.resScale || 1));
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    const dist = this.aspect < 1 ? 13 : 8.6;
    const halfW = Math.atan(6.6 / dist);
    const vfov = 2 * Math.atan(Math.tan(halfW) / this.aspect) * 180 / Math.PI;
    this.baseFov = THREE.MathUtils.clamp(vfov, 55, 80);
    this.camera.fov = this.baseFov;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    if (this.fx) this.fx.resize();
  }
}
