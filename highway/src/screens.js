// Screen builders (menu, garage, missions, game over). They read/write progress through progression.js and call back into Game.
import { GAME_NAME, GAME_TAGLINE } from './config.js';
import { CARS, TIERS, STAT_RANGE, carById } from './data/cars.js';
import { UPGRADES, MAX_LEVEL } from './data/upgrades.js';
import { save } from './storage.js';
import { h, fmt } from './ui.js';
import { CONTROL_MODES } from './controls.js';
import { carStats, levelsOf, isOwned, buyCar, selectCar, buyUpgrade, upgradeCost, ensureMissions, missionText } from './progression.js';

const tierName = (id) => TIERS.find((t) => t.id === id)?.name || id;
const coinPill = () => h('div', 'pill coins', `<i class="coin"></i><b>${fmt(save.data.coins)}</b>`);

export class Screens {
  constructor(game) { this.game = game; this.ui = game.ui; }

  wrap(cls = '') { return h('div', 'screen ' + cls); }
  show(node) { this.ui.showScreen(node); return node; }

  // ---------------- main menu ----------------
  menu() {
    const g = this.game; const car = carById(save.data.selectedCar);
    const card = h('div', 'card');
    card.append(h('h1', '', GAME_NAME), h('div', 'sub', GAME_TAGLINE));
    card.append(h('div', 'menu-car', `<span>${tierName(car.tier)}</span> ${car.name}`));
    const play = h('button', 'btn', 'Play'); play.onclick = () => g.startRun(); card.append(play);
    const row = h('div', 'btn-row');
    const garage = h('button', 'btn ghost', 'Garage'); garage.onclick = () => g.enterGarage();
    const missions = h('button', 'btn ghost', 'Missions'); missions.onclick = () => this.missions(() => this.menu());
    row.append(garage, missions); card.append(row);
    const row2 = h('div', 'btn-row');
    const settings = h('button', 'btn ghost', 'Settings'); settings.onclick = () => this.settings(() => this.menu());
    row2.append(settings); card.append(row2);
    card.append(coinPill());
    card.append(h('div', 'hint', '← → / A D lanes · Space nitro · P pause'));
    const w = this.wrap(); w.append(card); this.show(w);
  }

  // ---------------- settings ----------------
  settings(back) {
    const g = this.game, S = save.data.settings;
    const card = h('div', 'card');
    card.append(h('h2', '', 'SETTINGS'));
    const seg = (label, opts, get, set, note) => {
      const row = h('div', 'set-row'); row.append(h('b', '', label));
      const sg = h('div', 'seg');
      const nt = note ? h('small', '', note(get())) : null;
      for (const o of opts) {
        const b = h('button', get() === o.id ? 'on' : '', o.name);
        b.onclick = () => { set(o.id); save.save(); [...sg.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); if (nt) nt.textContent = note(o.id); };
        sg.append(b);
      }
      row.append(sg); if (nt) row.append(nt); card.append(row);
    };
    seg('Controls', CONTROL_MODES, () => S.control, (v) => { S.control = v; g.applyControls(); g.controls.show(false); }, (id) => CONTROL_MODES.find((m) => m.id === id)?.desc || '');
    seg('Sound', [{ id: true, name: 'On' }, { id: false, name: 'Off' }], () => S.sound, (v) => { S.sound = v; g.audio?.setEnabled(v); });
    seg('Graphics', [{ id: 'low', name: 'Low' }, { id: 'medium', name: 'Medium' }, { id: 'high', name: 'High' }], () => S.quality, (v) => { S.quality = v; g.applyQuality(); },
      (id) => ({ low: 'Fastest: no post-processing, fewer buildings', medium: 'Speed blur, balanced', high: 'Bloom glow + speed blur (best looking)' }[id]));
    seg('Haptics', [{ id: true, name: 'On' }, { id: false, name: 'Off' }], () => S.haptics, (v) => { S.haptics = v; }, () => 'Vibration on hits (Android/desktop browsers; iPhone ignores it)');
    const reset = h('button', 'btn danger', 'Reset progress');
    let armed = false;
    reset.onclick = () => {
      if (!armed) { armed = true; reset.textContent = 'Tap again to erase everything'; setTimeout(() => { armed = false; reset.textContent = 'Reset progress'; }, 3500); return; }
      g.resetProgress(); this.settings(back);
    };
    card.append(reset);
    const b = h('button', 'btn ghost', 'Back'); b.onclick = back; card.append(b);
    const w = this.wrap(); w.append(card); this.show(w);
  }

  // ---------------- missions ----------------
  missions(back) {
    const m = ensureMissions();
    const card = h('div', 'card');
    card.append(h('h2', '', 'DAILY MISSIONS'), h('div', 'sub', 'Refresh every day · rewards are paid when you finish a run'));
    for (const mi of m.list) {
      const pct = Math.min(100, (mi.progress / mi.target) * 100);
      const prog = mi.stat === 'distanceKm' ? mi.progress.toFixed(1) : fmt(mi.progress);
      const row = h('div', 'mission' + (mi.done ? ' done' : ''),
        `<div class="m-top"><span>${missionText(mi)}</span><b>${mi.done ? '✓' : '+' + fmt(mi.reward)}</b></div>
         <div class="m-bar"><i style="width:${pct}%"></i></div><div class="m-prog">${prog} / ${fmt(mi.target)}</div>`);
      card.append(row);
    }
    const b = h('button', 'btn ghost', 'Back'); b.onclick = back; card.append(b);
    const w = this.wrap(); w.append(card); this.show(w);
  }

  // ---------------- garage ----------------
  garage() {
    const g = this.game;
    const w = this.wrap('garage');
    const top = h('div', 'g-top');
    const back = h('button', 'btn ghost small', '‹ Back'); back.onclick = () => g.exitGarage();
    top.append(back, h('div', 'g-title', 'GARAGE'));
    const coins = coinPill(); top.append(coins);
    const prev = h('button', 'g-nav left', '‹'), next = h('button', 'g-nav right', '›');
    const panel = h('div', 'g-panel');
    w.append(top, prev, next, panel);
    let idx = Math.max(0, CARS.findIndex((c) => c.id === save.data.selectedCar));

    const render = () => {
      const car = CARS[idx]; const owned = isOwned(car.id);
      const lv = levelsOf(car.id); const st = carStats(car, lv);
      g.previewCar(car, st);
      coins.innerHTML = `<i class="coin"></i><b>${fmt(save.data.coins)}</b>`;
      panel.innerHTML = '';
      const sel = save.data.selectedCar === car.id;
      panel.append(h('div', 'g-head', `<span class="tier t-${car.tier}">${tierName(car.tier)}</span><h2>${car.name}</h2>
        <div class="g-best">${owned ? 'Best ' + fmt(save.data.bestByCar[car.id] || 0) : 'Not owned'}</div>`));
      const bars = h('div', 'bars');
      const bar = (label, key, text, cls = '') => {
        const [lo, hi] = STAT_RANGE[key]; const f = Math.max(0.04, Math.min(1, (st[key] - lo) / (hi - lo)));
        bars.append(h('div', 'bar ' + cls, `<span>${label}</span><div><i style="width:${f * 100}%"></i></div><b>${text}</b>`));
      };
      bar('Top speed', 'topSpeed', Math.round(st.topSpeed) + ' km/h');
      bar('Accel', 'accel', st.accel.toFixed(0));
      bar('Handling', 'handling', car.twitchy ? 'Twitchy' : (st.handling * 100).toFixed(0));
      bar('Combo', 'comboMult', '×' + st.comboMult.toFixed(2));
      bar('Nitro', 'nitro', st.nitro.toFixed(2));
      panel.append(bars);
      if (car.twitchy) panel.append(h('div', 'g-note', 'Fastest car, but hardest to control: it overshoots lanes.'));
      if (car.weight) panel.append(h('div', 'g-note', 'Heavy & stable with a high combo multiplier.'));

      if (owned) {
        const ups = h('div', 'ups');
        for (const u of UPGRADES) {
          const cur = lv[u.key] || 0; const maxed = cur >= MAX_LEVEL; const cost = upgradeCost(car, cur);
          const row = h('div', 'up');
          row.append(h('div', 'up-info', `<b>${u.name}</b><small>${u.desc}</small><div class="pips">${Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < cur ? 'on' : ''}"></i>`).join('')}</div>`));
          const b = h('button', 'btn small', maxed ? 'MAX' : `<i class="coin"></i>${fmt(cost)}`);
          b.disabled = maxed || save.data.coins < cost;
          b.onclick = () => { if (buyUpgrade(car.id, u.key)) render(); };
          row.append(b); ups.append(row);
        }
        panel.append(ups);
        const a = h('button', 'btn ' + (sel ? 'ghost' : 'pink'), sel ? 'Selected' : 'Select');
        a.disabled = sel; a.onclick = () => { selectCar(car.id); render(); };
        panel.append(a);
      } else {
        const a = h('button', 'btn pink', `Buy <i class="coin"></i>${fmt(car.price)}`);
        a.disabled = save.data.coins < car.price;
        a.onclick = () => { if (buyCar(car.id)) { selectCar(car.id); render(); } };
        panel.append(a);
        if (save.data.coins < car.price) panel.append(h('div', 'g-note', `Need ${fmt(car.price - save.data.coins)} more coins`));
      }
      const dots = h('div', 'dots'); CARS.forEach((c, i) => dots.append(h('i', (i === idx ? 'on ' : '') + (isOwned(c.id) ? 'own' : ''))));
      panel.append(dots);
    };
    prev.onclick = () => { idx = (idx + CARS.length - 1) % CARS.length; render(); };
    next.onclick = () => { idx = (idx + 1) % CARS.length; render(); };
    this.show(w); render();
  }

  // ---------------- game over ----------------
  gameOver(res, handlers) {
    const card = h('div', 'card');
    card.append(h('h2', '', res.title || 'CRASHED'));
    if (res.newBest) card.append(h('div', 'newbest', 'NEW PERSONAL BEST'));
    card.append(h('div', 'big', fmt(res.score)));
    card.append(h('div', 'stat-row', `<span>Best (${res.carName})</span><b>${fmt(res.best)}</b>`));
    card.append(h('div', 'stat-row', `<span>Top speed</span><b>${Math.round(res.kmh)} km/h</b>`));
    card.append(h('div', 'stat-row', `<span>Close calls</span><b>${res.closeCalls}</b>`));
    card.append(h('div', 'stat-row', `<span>Best combo</span><b>${res.bestCombo}</b>`));
    card.append(h('div', 'stat-row coin-row', `<span>Coins earned</span><b><i class="coin"></i>+${fmt(res.coins)}</b>`));
    for (const m of res.missionsDone || []) card.append(h('div', 'stat-row mdone', `<span>✓ ${missionText(m)}</span><b><i class="coin"></i>+${fmt(m.reward)}</b>`));
    card.append(h('div', 'stat-row', `<span>Total coins</span><b>${fmt(save.data.coins)}</b>`));
    const b = h('button', 'btn pink', 'Retry'); b.onclick = handlers.retry; card.append(b);
    const row = h('div', 'btn-row');
    const gar = h('button', 'btn ghost', 'Garage'); gar.onclick = handlers.garage;
    const men = h('button', 'btn ghost', 'Menu'); men.onclick = handlers.menu;
    row.append(gar, men); card.append(row);
    const w = this.wrap(); w.append(card); this.show(w);
  }
}
