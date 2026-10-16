// Garage and missions screens: builds their data from the save and handles their buttons.
// The 3D car behind the garage panel is the race view's car, swapped to match the preview.

import { CARS, TIER_BY_ID } from '../config/cars.js';
import { UPGRADES, MAX_LEVEL } from '../config/upgrades.js';
import { COSMETICS } from '../config/cosmetics.js';
import {
  carState, statBars, upgradeCost, buyCar, selectCar, upgrade, idleRate, cosmeticOwned, buyCosmetic,
  equipCosmetic, carLook,
} from './economy.js';
import { dailyMissions, claimMission, claimBonus, ALL_DONE_BONUS } from './missions.js';
import { storage } from '../core/storage.js';
import { EVENT_BY_ID } from './events.js';

function swatch(kind, item, car) {
  if (kind === 'paint') {
    const c = item.factory ? car.body.paint : item.paint.color;
    return `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85), ${c} 45%, rgba(0,0,0,0.6))${item.paint?.neon ? `;box-shadow:0 0 14px ${c}` : ''}`;
  }
  if (kind === 'rim') {
    const c = item.rim.color;
    return `radial-gradient(circle, #111 30%, ${c} 32%, ${c} 46%, #111 48%, #111 62%, ${c} 64%)${item.rim.neon ? `;box-shadow:0 0 14px ${c}` : ''}`;
  }
  return item.glow ? `radial-gradient(circle, ${item.glow}, transparent 70%);box-shadow:0 0 16px ${item.glow}` : 'repeating-linear-gradient(45deg, #333 0 4px, #222 4px 8px)';
}

export class GarageScreen {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.tab = 'car';
    this.preview = null; // cosmetic id being previewed in the current tab
    this.modelKey = '';
  }

  /** Cars shown in the garage: all regular cars plus event cars you own (or can win now). */
  cars() {
    const save = this.game.save;
    return [...CARS, ...this.game.extraCars()].filter((c, i, a) => a.indexOf(c) === i).filter((c) => !c.eventOnly || carState(save, c.id).owned || this.game.eventCarVisible(c.id));
  }

  open() {
    const list = this.cars();
    this.index = Math.max(0, list.findIndex((c) => c.id === this.game.save.selectedCar));
    this.tab = 'car';
    this.preview = null;
    this.render(true);
  }

  get car() {
    return this.cars()[this.index];
  }

  data() {
    const save = this.game.save;
    const car = this.car;
    const st = carState(save, car.id);
    const tier = TIER_BY_ID[car.tier];
    const d = {
      coins: save.coins,
      index: this.index,
      count: this.cars().length,
      tab: this.tab,
      idleRate: idleRate(save),
      car: {
        ...car,
        tierName: tier?.name ?? car.tier,
        tierColor: tier?.color ?? '#fff',
        owned: st.owned,
        selected: save.selectedCar === car.id,
        bars: statBars(car, st.up),
        eventNote: car.eventOnly ? `Win the ${EVENT_BY_ID[car.eventId]?.name ?? 'event'} event` : null,
      },
    };
    if (this.tab === 'upgrade') {
      d.upgrades = UPGRADES.map((u) => {
        const level = st.up[u.id];
        const cost = upgradeCost(car, u.id, level);
        return { ...u, level, max: MAX_LEVEL, cost, affordable: cost != null && save.coins >= cost };
      });
    }
    if (COSMETICS[this.tab]) {
      const kind = this.tab;
      const equipped = st[kind];
      d.items = COSMETICS[kind].map((it) => ({
        id: it.id,
        name: it.name,
        price: it.price,
        owned: cosmeticOwned(save, kind, it.id),
        equipped: it.id === equipped,
        previewing: it.id === (this.preview ?? equipped),
        swatch: swatch(kind, it, car),
      }));
      const pid = this.preview ?? equipped;
      const p = d.items.find((i) => i.id === pid);
      d.preview = p && { ...p, affordable: save.coins >= p.price };
    }
    return d;
  }

  /** Show the screen and make the 3D car match it. */
  render(first = false) {
    const g = this.game;
    const d = this.data();
    if (first) g.screens.show('garage', d);
    else g.screens.refresh(d);
    const car = this.car;
    const override = this.preview && COSMETICS[this.tab] ? { [this.tab]: this.preview } : {};
    const look = carLook(g.save, car, override);
    const key = `${car.id}:${JSON.stringify(look)}`;
    if (key !== this.modelKey) {
      this.modelKey = key;
      g.view.setCar(car, look);
    }
  }

  handlers() {
    const g = this.game;
    const done = (ok = true) => {
      if (ok) storage.save();
      this.render();
    };
    return {
      garage: () => {
        g.mode = 'garage';
        this.open();
      },
      prevCar: () => {
        this.index = (this.index - 1 + this.cars().length) % this.cars().length;
        this.preview = null;
        done(false);
      },
      nextCar: () => {
        this.index = (this.index + 1) % this.cars().length;
        this.preview = null;
        done(false);
      },
      tab: (d) => {
        this.tab = d.id;
        this.preview = null;
        done(false);
      },
      selectCar: () => done(selectCar(g.save, this.car.id)),
      buyCar: () => {
        const r = buyCar(g.save, this.car.id);
        if (!r.ok && r.reason === 'coins') g.toast('Not enough coins');
        if (r.ok) g.sound?.('buy');
        done(r.ok);
      },
      upgrade: (d) => {
        const r = upgrade(g.save, this.car.id, d.id);
        if (!r.ok && r.reason === 'coins') g.toast('Not enough coins');
        if (r.ok) g.sound?.('buy');
        done(r.ok);
      },
      preview: (d) => {
        this.preview = d.id;
        done(false);
      },
      equip: () => {
        const ok = equipCosmetic(g.save, this.car.id, this.tab, this.preview ?? carState(g.save, this.car.id)[this.tab]);
        this.preview = null;
        done(ok);
      },
      buyCosmetic: () => {
        const id = this.preview;
        const r = buyCosmetic(g.save, this.tab, id);
        if (!r.ok && r.reason === 'coins') g.toast('Not enough coins');
        if (r.ok) {
          equipCosmetic(g.save, this.car.id, this.tab, id);
          this.preview = null;
          g.sound?.('buy');
        }
        done(r.ok);
      },
      missions: () => {
        g.mode = 'menu';
        g.screens.show('missions', this.missionsData());
      },
      claim: (d) => {
        if (claimMission(g.save, Number(d.id))) g.sound?.('coin');
        storage.save();
        g.screens.refresh(this.missionsData());
      },
      claimBonus: () => {
        if (claimBonus(g.save)) g.sound?.('coin');
        storage.save();
        g.screens.refresh(this.missionsData());
      },
    };
  }

  missionsData() {
    const save = this.game.save;
    const m = dailyMissions(save);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(0, Math.round((midnight - now) / 6e4));
    return {
      coins: save.coins,
      list: m.list,
      bonus: ALL_DONE_BONUS,
      bonusClaimed: m.bonusClaimed,
      allClaimed: m.list.every((x) => x.claimed),
      resetIn: `${Math.floor(mins / 60)}h ${mins % 60}m`,
    };
  }
}

