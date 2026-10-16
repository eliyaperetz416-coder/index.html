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
import { CAR_BY_ID, CARS, effectiveStats } from '../config/cars.js';
import { RACE } from '../config/game.js';

export class Game {
  constructor() {
    this.save = storage.load();
    // ?quality=low|medium|high overrides the saved setting (handy for testing).
    const forced = new URLSearchParams(location.search).get('quality');
    this.renderer = new Renderer($('#stage'), resolveQuality(forced ?? this.save.settings.quality));
    this.input = new Input($('#touch'));
    this.hud = new Hud($('#hud'), { onNitro: () => (this.input.nitroQueued = true) });
    this.screens = new Screens($('#screens'), {
      ride: (e) => this.ride(e),
      next: () => this.next(),
      retry: () => this.start(this.race.track.id),
      menu: () => this.menu(),
      tracks: () => this.showTracks(),
      pick: (d) => this.start(d.id),
    });
    this.mode = 'boot';
    this.race = null;
    this.view = null;
    this.timeScale = 1;
    this.autopilot = null; // a Driver when the AI drives the player's car (tests, demos)
    this.loop = new Loop((dt) => this.tick(dt));
  }

  get carDef() {
    return CAR_BY_ID[this.save.selectedCar] ?? CARS[0];
  }

  get look() {
    return { paint: { color: this.carDef.body.paint, metal: 0.4, rough: 0.3 }, rim: { style: 'classic' }, glow: null };
  }

  boot() {
    this.menu();
    this.loop.start();
    const loading = $('#loading');
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 600);
  }

  /** Builds a race (and its view) without starting it. */
  prepare(trackId) {
    const track = TRACK_BY_ID[trackId] ?? TRACKS[0];
    this.view?.dispose();
    this.race = new Race({ track, stats: effectiveStats(this.carDef) });
    this.view = new RaceView(this.renderer, this.race, { carDef: this.carDef, look: this.look });
  }

  menu() {
    this.mode = 'menu';
    const track = currentTrack(this.save);
    if (this.race?.track.id !== track.id || this.race.state !== 'countdown') this.prepare(track.id);
    this.hud.show(false);
    this.screens.show('menu', { coins: this.save.coins, trackName: this.race.track.name });
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
      tracks: CAREER.filter((t) => t.world === w.id).map((t) => {
        const rec = trackRecord(this.save, t.id);
        return {
          ...t,
          locked: !isUnlocked(this.save, t),
          requiresName: TRACK_BY_ID[t.requires]?.name,
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
    if (e?.pointerId !== undefined) this.input.adopt(e);
  }

  start(trackId) {
    this.prepare(trackId);
    this.mode = 'race';
    this.resultShown = false;
    this.screens.hide();
    this.hud.show(true);
    this.save.lastTrack = trackId;
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
      if (race.state === 'finished' && !this.resultShown && race.after > RACE.finishCoast / Math.max(1, this.timeScale)) this.showResult();
    } else if (this.view) {
      this.view.orbit(dt);
    }
    this.renderer.render();
  }

  onRaceEvent(e) {
    this.view.onEvent(e);
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
      default:
    }
  }

  /** Let the AI drive (true/false). */
  setAutopilot(on) {
    this.autopilot = on ? new Driver({ skill: 1 }) : null;
  }

  showResult() {
    this.resultShown = true;
    const race = this.race;
    const track = race.track;
    const tally = race.tally();
    const res = recordResult(this.save, track, race.finishTime);
    if (res.firstClear) tally.lines.push({ label: 'First finish bonus', coins: track.reward ?? RACE.baseReward });
    if (res.betterMedal && res.medal) tally.lines.push({ label: `${res.medal[0].toUpperCase()}${res.medal.slice(1)} medal`, coins: { gold: 150, silver: 80, bronze: 40 }[res.medal] });
    tally.total = tally.lines.reduce((a, l) => a + l.coins, 0);
    this.save.coins += tally.total;
    this.save.stats.races++;
    storage.save();
    this.hud.show(false);
    this.screens.show('finish', {
      time: race.finishTime,
      best: res.best,
      newBest: res.newBest,
      medal: res.medal,
      unlocked: res.unlocked,
      tally,
      hasNext: !!nextTrack(this.save, track.id),
    });
  }
}
