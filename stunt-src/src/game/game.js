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
import { TRACKS, TRACK_BY_ID } from '../config/tracks.js';
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
    });
    this.mode = 'boot';
    this.race = null;
    this.view = null;
    this.timeScale = 1;
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
    this.prepare(this.save.lastTrack ?? TRACKS[0].id);
    this.hud.show(false);
    this.screens.show('menu', { coins: this.save.coins, trackName: this.race.track.name });
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
    const i = TRACKS.findIndex((t) => t.id === this.race.track.id);
    this.start(TRACKS[(i + 1) % TRACKS.length].id);
  }

  tick(dt) {
    if (this.mode === 'race') {
      const input = this.input.update(dt);
      const race = this.race;
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

  showResult() {
    this.resultShown = true;
    const race = this.race;
    const tally = race.tally();
    const id = race.track.id;
    const rec = (this.save.tracks[id] ??= { best: null, done: 0 });
    const newBest = rec.best == null || race.finishTime < rec.best;
    if (newBest) rec.best = race.finishTime;
    rec.done++;
    this.save.coins += tally.total;
    this.save.stats.races++;
    storage.save();
    this.hud.show(false);
    this.screens.show('finish', { time: race.finishTime, best: rec.best, newBest, tally, hasNext: TRACKS.length > 1 });
  }
}
