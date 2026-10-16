// Screen builders (menu, garage, missions, game over). They read/write progress through progression.js and call back into Game.
import { GAME_NAME, GAME_TAGLINE } from './config.js';
import { CARS, TIERS, STAT_RANGE, carById } from './data/cars.js';
import { UPGRADES, MAX_LEVEL } from './data/upgrades.js';
import { save } from './storage.js';
import { h, fmt } from './ui.js';
import { CONTROL_MODES } from './controls.js';
import { WORLDS } from './data/worlds.js';
import { listEvents, activeEvents, countdown, progressOf, isClaimed, DAY, occurrences, eventById } from './events.js';
import { carStats, levelsOf, isOwned, buyCar, selectCar, buyUpgrade, upgradeCost, ensureMissions, missionText } from './progression.js';

const tierName = (id) => TIERS.find((t) => t.id === id)?.name || id;
const coinPill = () => h('div', 'pill coins', `<i class="coin"></i><b>${fmt(save.data.coins)}</b>`);

export class Screens {
  constructor(game) { this.game = game; this.ui = game.ui; }

  wrap(cls = '') { return h('div', 'screen ' + cls); }
  show(node) { this.ui.showScreen(node); return node; }

  // ---------------- pause ----------------
  pause(handlers) {
    const g = this.game;
    const card = h('div', 'card');
    card.append(h('h2', '', 'PAUSED'));
    const r = h('button', 'btn', 'Resume'); r.onclick = handlers.resume; card.append(r);
    const row = h('div', 'btn-row');
    const snd = h('button', 'btn ghost', save.data.settings.sound ? 'Sound: On' : 'Sound: Off');
    snd.onclick = () => { save.data.settings.sound = !save.data.settings.sound; save.save(); g.audio.setEnabled(save.data.settings.sound); snd.textContent = save.data.settings.sound ? 'Sound: On' : 'Sound: Off'; };
    const ctl = h('button', 'btn ghost', 'Controls: ' + save.data.settings.control);
    ctl.onclick = () => { const ids = CONTROL_MODES.map((m) => m.id); const n = ids[(ids.indexOf(save.data.settings.control) + 1) % ids.length]; save.data.settings.control = n; save.save(); g.applyControls(); g.controls.show(false); ctl.textContent = 'Controls: ' + n; };
    row.append(snd, ctl); card.append(row);
    const row2 = h('div', 'btn-row');
    const rs = h('button', 'btn ghost', 'Restart'); rs.onclick = handlers.restart;
    const q = h('button', 'btn ghost danger', 'Quit run'); q.onclick = handlers.menu;
    row2.append(rs, q); card.append(row2);
    const w = this.wrap(); w.append(card); this.show(w);
  }

  // ---------------- main menu ----------------
  menu() {
    const g = this.game; const car = carById(save.data.selectedCar);
    const card = h('div', 'card');
    card.append(h('h1', '', GAME_NAME), h('div', 'sub', GAME_TAGLINE));
    card.append(h('div', 'menu-car', `<span>${tierName(car.tier)}</span> ${car.name}`));
    const worlds = h('div', 'world-chips');
    for (const w of Object.values(WORLDS)) {
      const b = h('button', save.data.settings.world === w.id ? 'on' : '', w.name);
      b.onclick = () => { save.data.settings.world = w.id; save.save(); g.loadWorld(w.id); [...worlds.children].forEach((c) => c.classList.toggle('on', c === b)); };
      worlds.append(b);
    }
    card.append(worlds);
    const play = h('button', 'btn', 'Play'); play.onclick = () => g.startRun(); card.append(play);
    const row = h('div', 'btn-row');
    const garage = h('button', 'btn ghost', 'Garage'); garage.onclick = () => g.enterGarage();
    const missions = h('button', 'btn ghost', 'Missions'); missions.onclick = () => this.missions(() => this.menu());
    row.append(garage, missions); card.append(row);
    const row2 = h('div', 'btn-row');
    const settings = h('button', 'btn ghost', 'Settings'); settings.onclick = () => this.settings(() => this.menu());
    const nAct = activeEvents().length;
    const events = h('button', 'btn ghost', `Events${nAct ? ` <span class="badge">${nAct}</span>` : ''}`); events.onclick = () => this.events(() => this.menu());
    row2.append(events, settings); card.append(row2);
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

  // ---------------- events / calendar ----------------
  events(back) {
    const g = this.game, now = Date.now();
    const card = h('div', 'card wide');
    card.append(h('h2', '', 'EVENTS'), h('div', 'sub', 'Limited-time events · next 14 days'));
    const today = new Date(); today.setHours(0, 0, 0, 0); const t0 = today.getTime();
    const dayNames = Array.from({ length: 14 }, (_, i) => new Date(t0 + i * DAY).toLocaleDateString(undefined, { weekday: 'narrow' }));
    const list = listEvents(now);
    if (!list.length) card.append(h('div', 'hint', 'No events scheduled right now.'));
    const head = h('div', 'cal-head'); dayNames.forEach((d, i) => head.append(h('i', i === 0 ? 'today' : '', d))); 
    card.append(h('div', 'cal-legend', '<span></span>'), head);
    for (const st of list) {
      const ev = st.ev, active = st.state === 'active';
      const box = h('div', 'event' + (active ? ' active' : ''));
      box.style.setProperty('--ec', ev.color);
      box.append(h('div', 'e-top', `<b>${ev.name}</b><span class="chip ${active ? 'on' : ''}">${active ? 'ACTIVE · ends in ' + countdown(st.end - now) : 'Starts in ' + countdown(st.start - now)}</span>`));
      // 14 day strip
      const strip = h('div', 'strip');
      const occs = occurrences(ev, t0, t0 + 14 * DAY);
      for (let i = 0; i < 14; i++) {
        const a = t0 + i * DAY, b = a + DAY;
        strip.append(h('i', occs.some((o) => o.start < b && o.end > a) ? 'on' : ''));
      }
      box.append(strip);
      box.append(h('div', 'e-blurb', ev.blurb));
      const perks = [];
      if (ev.world) perks.push(`World: ${WORLDS[ev.world]?.name || ev.world}`);
      if (ev.modifiers?.coinMult) perks.push(`×${ev.modifiers.coinMult} coins`);
      if (perks.length) box.append(h('div', 'e-perks', perks.join(' · ')));
      if (ev.goal) {
        const done = isClaimed(st.key), p = done ? ev.goal.target : progressOf(st.key);
        const pct = Math.min(100, (p / ev.goal.target) * 100);
        box.append(h('div', 'e-goal', `<div class="m-top"><span>${ev.goal.text.replace('{n}', fmt(ev.goal.target))}</span><b>${done ? '✓ done' : ''}</b></div><div class="m-bar"><i style="width:${pct}%"></i></div><div class="m-prog">${ev.goal.stat === 'distanceKm' ? p.toFixed(1) : fmt(p)} / ${fmt(ev.goal.target)}</div>`));
      }
      if (ev.reward) {
        const car = ev.reward.car ? CARS.find((c) => c.id === ev.reward.car) : null;
        box.append(h('div', 'e-reward', `Reward: ${ev.reward.coins ? `<i class="coin"></i>${fmt(ev.reward.coins)}` : ''}${car ? ` · <b>${car.name}</b> (event-only car)` : ''}`));
      }
      if (active && ev.world) {
        const done = ev.goal && isClaimed(st.key);
        const b = h('button', 'btn pink', done ? 'Play again' : 'Play event'); b.onclick = () => g.startRun({ event: st }); box.append(b);
      }
      card.append(box);
    }
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
        if (car.event) {
          const ev = eventById(car.event);
          const a = h('button', 'btn ghost', 'Event reward'); a.disabled = true; panel.append(a);
          panel.append(h('div', 'g-note', `Only available by completing the event “${ev ? ev.name : car.event}”.`));
        } else {
          const a = h('button', 'btn pink', `Buy <i class="coin"></i>${fmt(car.price)}`);
          a.disabled = save.data.coins < car.price;
          a.onclick = () => { if (buyCar(car.id)) { selectCar(car.id); render(); } };
          panel.append(a);
          if (save.data.coins < car.price) panel.append(h('div', 'g-note', `Need ${fmt(car.price - save.data.coins)} more coins`));
        }
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
    card.append(h('div', 'stat-row coin-row', `<span>Coins earned${res.bonus > 1 ? ` (×${res.bonus.toFixed(2).replace(/\.?0+$/, '')} bonus)` : ''}</span><b><i class="coin"></i>+${fmt(res.coins)}</b>`));
    if (res.event && res.eventRes) {
      const er = res.eventRes, goal = res.event.ev.goal;
      if (er.completed) {
        const car = res.event.ev.reward?.car ? carById(res.event.ev.reward.car) : null;
        card.append(h('div', 'event-done', `🏆 EVENT COMPLETE: ${res.event.ev.name}<br><small>+${fmt(res.event.ev.reward?.coins || 0)} coins${car ? ` · unlocked ${car.name}` : ''}</small>`));
      } else card.append(h('div', 'stat-row', `<span>${res.event.ev.name}</span><b>${goal.stat === 'distanceKm' ? er.progress.toFixed(1) : fmt(er.progress)} / ${fmt(er.target)}</b>`));
    }
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
