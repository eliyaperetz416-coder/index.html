// The game controller: owns the renderer, input and save, switches between menu and races.

import { Renderer, resolveQuality } from '../render/renderer.js';
import { Input } from '../core/input.js';
import { Loop } from '../core/loop.js';
import { storage } from '../core/storage.js';
import { Race } from './race.js';
import { RaceView } from './raceView.js';
import { Hud } from '../ui/hud.js';
import { Screens } from '../ui/screens.js';
import { $ } from '../ui/dom.js';
import { CAREER, TRACKS, TRACK_BY_ID } from '../config/tracks.js';
import { WORLDS } from '../config/worlds.js';
import { isUnlocked, currentTrack, nextTrack, recordResult, trackRecord } from './progress.js';
import { Driver } from './ai.js';
import { CARS, carById } from '../config/cars.js';
import { effectiveStats, carState, carLook, idlePending, idleRate, collectIdle } from './economy.js';
import { trackMissions, raceStats, claimable } from './missions.js';
import { GarageScreen } from './garageScreen.js';
import { bossRivals } from './boss.js';
import { EVENT_BY_ID, EVENTS, calendar, eventTrackId, recordEvent, eventRecord, goalText, openEvents, fmtSpan, isLive } from './events.js';
import { WORLD_BY_ID } from '../config/worlds.js';
import { RACE } from '../config/game.js';
import { IDLE_MIN_MINUTES, IDLE_CAP_HOURS } from '../config/upgrades.js';
import { fmtCoins, COIN } from '../ui/dom.js';
import { sound } from '../audio/sound.js';
import { haptic, HAPTIC, setHaptics } from '../core/haptics.js';
import { Controls } from '../ui/controls.js';

const BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

export class Game {
  constructor() {
    this.save = storage.load();
    // ?quality=low|medium|high overrides the saved setting (handy for testing).
    const forced = new URLSearchParams(location.search).get('quality');
    this.renderer = new Renderer($('#stage'), resolveQuality(forced ?? this.save.settings.quality));
    this.input = new Input($('#touch'));
    this.input.onFirstGesture = () => sound.unlock();
    // Any tap anywhere (menus, HOLD TO RIDE) may start audio; browsers require a gesture.
    document.addEventListener('pointerdown', () => sound.unlock(), { capture: true });
    this.controls = new Controls($('#controls'), this.input);
    this.hud = new Hud($('#hud'), { onNitro: () => (this.input.nitroQueued = true), onPause: () => this.pause() });
    this.garage = new GarageScreen(this);
    this.screens = new Screens($('#screens'), {
      ride: (e) => this.ride(e),
      next: () => this.next(),
      retry: () => this.start(this.race.track.id),
      menu: () => this.menu(),
      tracks: () => this.showTracks(),
      pick: (d) => this.pick(d.id),
      raceBoss: (d) => this.start(d.id),
      events: () => this.showEvents(),
      playEvent: (d) => this.start(eventTrackId(EVENT_BY_ID[d.id])),
      closeModal: () => this.screens.closeModal(),
      collectIdle: () => this.collectIdle(),
      ...this.garage.handlers(),
      ...this.settingsHandlers(),
    }, $('#modal'));
    this.screens.onAction = () => {
      sound.unlock();
      sound.play('click');
      haptic(HAPTIC.tap);
    };
    this.sound = (name) => sound.play(name);
    this.applySettings();
    this.mode = 'boot';
    this.race = null;
    this.view = null;
    this.timeScale = 1;
    this.autopilot = null; // a Driver when the AI drives the player's car (tests, demos)
    this.loop = new Loop((dt) => this.tick(dt));
  }

  get carDef() {
    const car = carById(this.save.selectedCar);
    return car && carState(this.save, car.id).owned ? car : CARS[0];
  }

  get look() {
    return carLook(this.save, this.carDef);
  }

  get settings() {
    const st = this.save.settings;
    return { control: 'drag', sound: true, volume: 0.8, haptics: true, quality: 'auto', ...st };
  }

  applySettings() {
    const st = this.settings;
    this.controls.setStyle(st.control);
    sound.setEnabled(st.sound);
    sound.setVolume(st.volume);
    setHaptics(st.haptics);
  }

  setSetting(key, value) {
    this.save.settings = { ...this.settings, [key]: value };
    storage.save();
    this.applySettings();
  }

  showSettings(back = 'menu') {
    this.settingsBack = back;
    const st = this.settings;
    const data = { ...st, back: back === 'pause' ? 'pauseBack' : 'menu', activeQuality: this.renderer.quality.name, build: BUILD };
    if (this.screens.current === 'settings') this.screens.refresh(data);
    else this.screens.show('settings', data);
  }

  settingsHandlers() {
    return {
      settings: () => this.showSettings('menu'),
      pauseSettings: () => this.showSettings('pause'),
      pauseBack: () => this.showPause(),
      setControl: (d) => {
        this.setSetting('control', d.id);
        this.showSettings(this.settingsBack);
      },
      toggleSound: () => {
        this.setSetting('sound', !this.settings.sound);
        this.showSettings(this.settingsBack);
      },
      toggleHaptics: () => {
        this.setSetting('haptics', !this.settings.haptics);
        if (this.settings.haptics) haptic(HAPTIC.nitro);
        this.showSettings(this.settingsBack);
      },
      input: (name, value) => {
        if (name === 'volume') this.setSetting('volume', Number(value) / 100);
      },
      setQuality: (d) => {
        this.setSetting('quality', d.id);
        this.renderer.setQuality(resolveQuality(d.id));
        // Scenery and materials are rebuilt for the new preset on the next race.
        if (this.mode !== 'paused') this.prepare(this.race.track.id);
        this.showSettings(this.settingsBack);
      },
      askReset: () => this.screens.modal({
        title: 'RESET EVERYTHING?',
        body: 'Coins, cars, upgrades, best times and settings will be erased. This cannot be undone.',
        button: 'YES, ERASE MY PROGRESS',
        action: 'confirmReset',
      }),
      confirmReset: () => {
        storage.reset();
        location.reload();
      },
      resume: () => this.resume(),
      restart: () => this.start(this.race.track.id),
      quit: () => {
        sound.engineStop();
        this.menu();
      },
    };
  }

  pause() {
    if (this.mode !== 'race' || this.race.state === 'finished') return;
    this.mode = 'paused';
    sound.engineStop();
    this.controls.show(false);
    this.hud.show(false);
    this.showPause();
  }

  showPause() {
    this.screens.show('pause', { track: this.race.track.name });
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'race';
    this.screens.hide();
    this.hud.root.hidden = false;
    this.controls.show(true);
    sound.engineStart();
    this.loop.last = performance.now();
  }

  /** Event cars for the garage. */
  extraCars() {
    return EVENTS.flatMap((e) => (e.cars ?? []).map((c) => carById(c.id)));
  }

  /** Event cars show in the garage while their event is on (so you can see what you can win). */
  eventCarVisible(id) {
    const car = carById(id);
    return !!car && isLive(EVENT_BY_ID[car.eventId]);
  }

  showEvents() {
    this.mode = 'menu';
    const now = new Date();
    const cal = calendar(now);
    const dress = (x) => ({ ...x, goal: goalText(x.event.goal), endsIn: fmtSpan(x.end - now), startsIn: fmtSpan(x.start - now) });
    const carNames = Object.fromEntries(this.extraCars().map((c) => [c.id, c.name]));
    const records = Object.fromEntries(EVENTS.map((e) => [e.id, eventRecord(this.save, e.id)]));
    this.screens.show('events', { coins: this.save.coins, live: cal.live.map(dress), upcoming: cal.upcoming.map(dress), ended: cal.ended.map(dress), carNames, records });
  }

  boot() {
    this.menu();
    this.loop.start();
    const loading = $('#loading');
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 600);
    this.checkIdle();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
        sound.engineStop();
      } else if (this.mode !== 'race' && this.mode !== 'paused') this.checkIdle();
    });
  }

  /** Welcome-back pop-up with the coins the garage earned while you were away. */
  checkIdle() {
    const p = idlePending(this.save);
    if (idleRate(this.save) <= 0) {
      collectIdle(this.save, Date.now(), { force: true });
      return;
    }
    if (p.minutes < IDLE_MIN_MINUTES || p.coins < 1) return;
    this.screens.modal({
      title: 'WELCOME BACK!',
      body: `Your garage earned ${COIN}<b>${fmtCoins(p.coins)}</b> while you were away${p.capped ? ` (the most it holds is ${IDLE_CAP_HOURS} hours)` : ''}.`,
      button: 'COLLECT',
      action: 'collectIdle',
    });
  }

  collectIdle() {
    const coins = collectIdle(this.save, Date.now(), { force: true });
    storage.save();
    this.screens.closeModal();
    if (coins && this.screens.current === 'menu') this.menu();
    this.sound?.('coin');
  }

  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1600);
  }

  /** Builds a race (and its view) without starting it. */
  prepare(trackId) {
    const track = TRACK_BY_ID[trackId] ?? TRACKS[0];
    const car = this.carDef;
    this.view?.dispose();
    const stats = effectiveStats(car, carState(this.save, car.id).up);
    const modifiers = EVENT_BY_ID[track.event]?.modifiers ?? {};
    this.race = new Race({ track, stats, rivals: bossRivals(track, stats), modifiers });
    this.view = new RaceView(this.renderer, this.race, { carDef: car, look: this.look });
    this.garage.modelKey = '';
  }

  menu() {
    this.mode = 'menu';
    this.controls.show(false);
    sound.engineStop();
    const track = currentTrack(this.save);
    const carChanged = this.view?.carDef !== this.carDef || this.garage.modelKey;
    if (this.race?.track.id !== track.id || this.race.state !== 'countdown' || carChanged) this.prepare(track.id);
    this.hud.show(false);
    this.screens.show('menu', { coins: this.save.coins, trackName: this.race.track.name, missionsReady: claimable(this.save), eventsLive: openEvents(this.save).length });
  }

  /** Track list tap: boss tracks show the rival first. */
  pick(id) {
    const track = TRACK_BY_ID[id];
    if (!track?.boss) {
      this.start(id);
      return;
    }
    this.save.lastTrack = id;
    this.prepare(id);
    const b = track.boss;
    this.screens.show('bossIntro', {
      id,
      name: b.name,
      taunt: b.taunt,
      car: b.car.name,
      track: track.name,
      reward: track.reward,
      glow: b.glow,
      losses: trackRecord(this.save, id).losses ?? 0,
    });
  }

  /** Pick the track the start button plays (used by tests and the track list). */
  selectTrack(id) {
    this.save.lastTrack = id;
    this.menu();
  }

  showTracks() {
    this.mode = 'menu';
    const current = currentTrack(this.save).id;
    const groups = WORLDS.map((w) => ({
      title: w.name.toUpperCase(),
      blurb: w.blurb,
      locked: !!w.requires && !trackRecord(this.save, w.requires).done,
      lockNote: w.requires ? `Beat ${TRACK_BY_ID[w.requires]?.boss?.name ?? TRACK_BY_ID[w.requires]?.name} to open this world` : '',
      tracks: CAREER.filter((t) => t.world === w.id).map((t) => {
        const rec = trackRecord(this.save, t.id);
        const req = TRACK_BY_ID[t.requires];
        return {
          ...t,
          bossName: t.boss?.name,
          locked: !isUnlocked(this.save, t),
          requiresName: req?.boss ? `beat ${req.boss.name}` : `finish ${req?.name}`,
          best: rec.best,
          medal: rec.medal,
          current: t.id === current,
        };
      }),
    })).filter((g) => g.tracks.length);
    this.screens.show('tracks', { coins: this.save.coins, groups });
  }

  /** HOLD TO RIDE: start the race and keep the finger that pressed the button as the throttle. */
  ride(e) {
    this.start(this.race.track.id);
    if (e?.pointerId !== undefined && this.input.style === 'drag') this.input.adopt(e);
  }

  start(trackId) {
    this.prepare(trackId);
    this.mode = 'race';
    this.resultShown = false;
    this.screens.hide();
    this.hud.show(true);
    this.controls.show(true);
    sound.engineStop();
    sound.engineStart();
    if (!TRACK_BY_ID[trackId]?.event) this.save.lastTrack = trackId; // events are played from the calendar
    storage.save();
  }

  next() {
    const next = nextTrack(this.save, this.race.track.id);
    this.start(next ? next.id : this.race.track.id);
  }

  tick(dt) {
    if (this.mode === 'race') {
      const race = this.race;
      const sdt0 = dt * this.timeScale;
      const input = this.autopilot ? this.autopilot.update(sdt0, race, race.car) : this.input.update(dt);
      const sdt = dt * this.timeScale;
      race.update(sdt, input);
      for (const e of race.events) this.onRaceEvent(e);
      race.events.length = 0;
      this.view.update(sdt, input);
      this.hud.update(race);
      this.controls.update();
      sound.engineUpdate(race.car.speed, race.state === 'racing' ? input.throttle : 0.3, race.car.boostTime > 0);
      this.renderer.adapt(dt);
      if (race.state === 'finished' && !this.resultShown && race.after > RACE.finishCoast / Math.max(1, this.timeScale)) this.showResult();
    } else if (this.mode === 'paused') {
      // Frozen frame behind the pause menu.
    } else if (this.view) {
      this.view.orbit(dt, this.mode === 'garage' ? 'garage' : 'menu');
    }
    this.renderer.render();
  }

  onRaceEvent(e) {
    this.view.onEvent(e);
    this.feedback(e);
    const hud = this.hud;
    switch (e.type) {
      case 'count': hud.flash(String(e.n)); break;
      case 'go':
        hud.flash('GO!', 'go');
        if (e.perfect) hud.popup('GREAT START!', 'good');
        break;
      case 'finish': hud.flash('FINISH', 'go'); break;
      case 'crash': hud.popup('CRASH!', 'bad'); hud.edge('hit'); break;
      case 'respawn': hud.popup('BACK ON TRACK', 'bad'); break;
      case 'hit': hud.popup('SLOWED!', 'bad'); hud.edge('hit'); break;
      case 'boost': hud.popup('BOOST!', 'gold'); hud.edge('boost'); break;
      case 'nitro': hud.popup('NITRO!', 'good'); hud.edge('boost'); break;
      case 'nearMiss': hud.popup(`NEAR MISS +${e.points}`, 'gold'); break;
      case 'oil': hud.popup('SLIPPERY!', 'bad'); break;
      case 'drift':
        if (e.time > 0.6) hud.popup(`DRIFT ${e.time.toFixed(1)}s`, 'good');
        break;
      case 'land':
        if (e.airTime > 1.2) hud.popup(`BIG AIR ${e.airTime.toFixed(1)}s`, 'good');
        break;
      case 'flip': hud.popup(e.flips ? 'BACKFLIP!' : 'BARREL ROLL!', 'good'); break;
      case 'rammed': hud.popup('RAMMED!', 'bad'); hud.edge('hit'); break;
      case 'ramRival': hud.popup('SHOVED HIM!', 'gold'); break;
      case 'rivalFinish': if (e.first) hud.popup(`${e.name} FINISHED`, 'bad'); break;
      case 'sand': hud.popup('SAND TRAP!', 'bad'); break;
      case 'boulder': hud.popup('BOULDER!', 'bad'); break;
      default:
    }
  }

  /** Sound and vibration for race events. */
  feedback(e) {
    const SOUND = { count: 'count', go: 'go', coin: 'coin', boost: 'boost', nitro: 'nitro', nearMiss: 'nearMiss', hit: 'hit', crash: 'crash', wall: 'wall', flip: 'flip', rammed: 'ram', ramRival: 'ram', bumped: 'wall', oil: 'oil', sand: 'oil', launch: 'launch', finish: 'finish' };
    if (e.type === 'land' && e.impact > 6) sound.play('land');
    else if (SOUND[e.type]) sound.play(SOUND[e.type]);
    const HAP = { hit: HAPTIC.hit, crash: HAPTIC.crash, boost: HAPTIC.boost, nitro: HAPTIC.nitro, nearMiss: HAPTIC.nearMiss, rammed: HAPTIC.ram };
    if (e.type === 'land' && e.impact > 8) haptic(HAPTIC.land);
    else if (HAP[e.type]) haptic(HAP[e.type]);
  }

  /** Let the AI drive (true/false). */
  setAutopilot(on) {
    this.autopilot = on ? new Driver({ skill: 1 }) : null;
  }

  showResult() {
    this.resultShown = true;
    sound.engineStop();
    this.controls.show(false);
    if (this.race.track.boss && !this.race.won) sound.play('lose');
    const race = this.race;
    const track = race.track;
    if (track.event) {
      this.showEventResult();
      return;
    }
    const tally = race.tally();
    const boss = !!track.boss;
    const won = boss ? race.won : true;
    const res = recordResult(this.save, track, race.finishTime, { won });
    if (boss) {
      // Win: full reward plus a bounty the first time. Lose: a small consolation.
      tally.lines[0] = won ? { label: `Beat ${track.boss.name}`, coins: track.reward } : { label: 'Rival race', coins: Math.round(track.reward * 0.2) };
    }
    if (res.firstClear) tally.lines.push({ label: boss ? 'Bounty' : 'First finish bonus', coins: track.reward ?? RACE.baseReward });
    if (res.betterMedal && res.medal) tally.lines.push({ label: `${res.medal[0].toUpperCase()}${res.medal.slice(1)} medal`, coins: { gold: 150, silver: 80, bronze: 40 }[res.medal] });
    tally.total = tally.lines.reduce((a, l) => a + l.coins, 0);
    this.save.coins += tally.total;
    this.save.stats.races++;
    const missionsDone = trackMissions(this.save, raceStats(race, { medal: res.medal, bossWin: boss && won }));
    const worlds = [...new Set(res.unlocked.map((t) => t.world))].filter((w) => w !== track.world).map((w) => WORLD_BY_ID[w]?.name);
    storage.save();
    this.hud.show(false);
    this.screens.show('finish', {
      time: race.finishTime,
      best: res.best,
      newBest: res.newBest,
      medal: res.medal,
      unlocked: res.unlocked,
      worlds,
      missionsDone,
      title: boss ? (won ? 'YOU WIN!' : 'RIVAL WINS') : 'FINISH!',
      lost: boss && !won,
      rival: boss ? { name: track.boss.name, time: race.rivals[0]?.finished ? race.rivals[0].finishTime : null } : null,
      tally,
      hasNext: !!nextTrack(this.save, track.id),
    });
  }

  showEventResult() {
    const race = this.race;
    const event = EVENT_BY_ID[race.track.event];
    const tally = race.tally();
    tally.lines[0] = { label: 'Event run', coins: race.track.reward ?? 100 };
    tally.total = tally.lines.reduce((a, l) => a + l.coins, 0);
    this.save.coins += tally.total;
    this.save.stats.races++;
    const res = recordEvent(this.save, event, race);
    const missionsDone = trackMissions(this.save, raceStats(race, { event: true }));
    storage.save();
    this.hud.show(false);
    this.screens.show('finish', {
      time: race.finishTime,
      best: res.record.best,
      newBest: res.record.best === race.finishTime && res.record.runs > 1,
      tally,
      missionsDone,
      hasNext: false,
      title: res.rewards ? 'EVENT WON!' : 'FINISH!',
      event: {
        goal: goalText(event.goal),
        progress: res.progress,
        met: res.met,
        live: isLive(event),
        rewards: res.rewards && { ...res.rewards, carName: res.rewards.car ? carById(res.rewards.car)?.name : null },
      },
    });
  }
}
