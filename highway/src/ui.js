// DOM UI: HUD, touch controls and screens. No game logic in here.
export function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
export const fmt = (n) => Math.round(n).toLocaleString('en-US');

export class UI {
  constructor() {
    this.hudEl = document.getElementById('hud');
    this.screensEl = document.getElementById('screens');
    this._buildHud();
    this.nitroBtn = null;
  }

  _buildHud() {
    this.hudEl.innerHTML = '';
    const score = h('div', 'hud-score', '<div class="lbl">Score</div><div class="val" data-k="score">0</div>');
    const speed = h('div', 'hud-speed', '<div class="lbl">Speed</div><div><span class="val" data-k="speed">0</span><span class="unit">km/h</span></div>');
    const combo = h('div', 'hud-combo', '<div class="c-count"></div><div class="c-mult"></div><div class="c-bar"><i></i></div>');
    const nitro = h('div', 'hud-nitro', '<div class="n-lbl">NITRO</div><div class="n-bar"><i></i></div>');
    this.popups = h('div', 'popups');
    this.flash = h('div', 'flash');
    const pauseBtn = h('div', 'pause-btn', '❚❚'); pauseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onPause && this.onPause(); });
    this.hudEl.append(score, speed, combo, nitro, this.popups, this.flash, pauseBtn);
    this.elScore = score.querySelector('[data-k=score]');
    this.elSpeed = speed.querySelector('[data-k=speed]');
    this.elCombo = combo; this.elComboCount = combo.querySelector('.c-count'); this.elComboMult = combo.querySelector('.c-mult');
    this.elComboBar = combo.querySelector('.c-bar i');
    this.elNitro = nitro; this.elNitroBar = nitro.querySelector('.n-bar i');
    this._last = {};
  }

  setCombo(combo, mult, timeFrac) {
    const on = combo > 0;
    this.elCombo.classList.toggle('on', on);
    if (!on) { this._last.combo = 0; return; }
    if (this._last.combo !== combo) {
      this.elComboCount.textContent = combo + ' COMBO'; this.elComboMult.textContent = '×' + mult.toFixed(1);
      this.elCombo.classList.remove('pulse'); void this.elCombo.offsetWidth; this.elCombo.classList.add('pulse');
      this._last.combo = combo;
    }
    this.elComboBar.style.transform = `scaleX(${Math.max(0, Math.min(1, timeFrac))})`;
  }
  setNitro(meter, active, locked) {
    this.elNitroBar.style.transform = `scaleX(${meter / 100})`;
    this.elNitro.classList.toggle('active', active); this.elNitro.classList.toggle('locked', locked);
    if (this.nitroBtn) { this.nitroBtn.classList.toggle('active', active); this.nitroBtn.classList.toggle('locked', locked); }
  }
  popup(text, kind = '') {
    const e = h('div', 'popup ' + kind, text);
    this.popups.append(e);
    while (this.popups.children.length > 4) this.popups.firstChild.remove();
    e.addEventListener('animationend', () => e.remove());
  }
  flashScreen(kind = 'red') {
    this.flash.className = 'flash'; void this.flash.offsetWidth; this.flash.className = 'flash ' + kind;
  }

  setHud({ score, kmh }) {
    const si = Math.floor(score), k = String(Math.round(kmh));
    if (this._last.si !== si) { this._last.si = si; this.elScore.textContent = fmt(si); }
    if (this._last.k !== k) { this.elSpeed.textContent = k; this._last.k = k; }
  }
  /** black fade out -> cb() -> fade back in */
  fade(cb) {
    const f = h('div', 'fader'); document.getElementById('app').append(f);
    requestAnimationFrame(() => { f.classList.add('on'); });
    setTimeout(() => { cb(); requestAnimationFrame(() => { f.classList.remove('on'); setTimeout(() => f.remove(), 260); }); }, 230);
  }
  showHud(v) { this.hudEl.style.display = v ? '' : 'none'; }

  // ---- screens ----
  clearScreens() { this.screensEl.innerHTML = ''; }
  showScreen(node) { this.clearScreens(); this.screensEl.append(node); return node; }
}
